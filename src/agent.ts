import { OpenAIEmbeddings } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { StateGraph, Annotation, END, START } from "@langchain/langgraph";
import { tool } from "@langchain/core/tools";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { MongoClient } from "mongodb";
import { z } from "zod";
import dotenv from "dotenv";
import { query } from "express";
dotenv.config();

//call the agent
export async function callAgent(
  client: MongoClient,
  query: string,
  thread_id: string
) {
  try {
    const dbName = "hr_database";
    const db = client.db(dbName);
    const collection = db.collection("employees");

    //graph state
    //the graph state keeps track of conversations between states
    const GraphState = Annotation.Root({
      messages: Annotation<BaseMessage[]>({
        reducer: (x, y) => x.concat(y),
      }),
    });

    const employeeLookupTool = tool(
      async ({ query, n = 10 }) => {
        console.log("Employee lookup tool called");

        const dbConfig = {
          collection: collection,
          indexName: "vector_index",
          textKey: "embedding_text",
          embeddingKey: "embedding",
        };

        const vectorStore = new MongoDBAtlasVectorSearch(
          new OpenAIEmbeddings(),
          dbConfig
        );

        const result = await vectorStore.similaritySearchWithScore(query, n);
        return JSON.stringify(result);
      },
      {
        name: "employee_lookup",
        description: "Gathers employee details from the HR database",
        schema: z.object({
          query: z.string().describe("The search query"),
          n: z
            .number()
            .optional()
            .default(10)
            .describe("Number of results to return"),
        }),
      }
    );

    //creating a toolnode
    const tools = [employeeLookupTool];
    //extract the state typing via GraphState.state
    const toolNode = new ToolNode<typeof GraphState.State>(tools);
    //defining the chat model
    const model = new ChatAnthropic({
      model: "claude-3-5-sonnet-20240620",
      temperature: 0.7,
    }).bindTools(tools);

    async function callModel(state: typeof GraphState.State) {
      const prompt = ChatPromptTemplate.fromMessages([
        [
          "system",
          `You are a helpful AI assistant, collaborating with other assistants. 
          Use the provided tools to progress towards answering the question. 
          If you are unable to fully answer, 
          that's OK, another assistant with different tools will help where you left off. 
          Execute what you can to make progress. 
          If you or any of the other assistants have the final answer or deliverable, 
          prefix your response with FINAL ANSWER so the team knows to stop. 
          You have access to the following tools: 
          {tool_names}.\n{system_message}\nCurrent time: {time}.`,
        ],
        new MessagesPlaceholder("messages"),
      ]);

      const formattedPrompt = await prompt.formatMessages({
        system_message: "You are helpful HR Chatbot Agent.",
        time: new Date().toISOString(),
        tool_names: tools.map((tool) => tool.name).join(", "),
        messages: state.messages,
      });

      const result = await model.invoke(formattedPrompt);

      return { messages: [result] };
    }

    function shouldContinue(state: typeof GraphState.State) {
      const messages = state.messages;
      const lastMessage = messages[messages.length - 1] as AIMessage;
      if (lastMessage.tool_calls?.length) {
        return "tools";
      }
      return END;
    }

    const workFlow = new StateGraph(GraphState)
      .addNode("agent", callModel)
      .addNode("tools", toolNode)
      .addEdge(START, "agent")
      .addConditionalEdges("agent", shouldContinue)
      .addEdge("tools", "agent");

    const checkpointer = new MongoDBSaver({
      client,
      dbName,
    });

    const app = workFlow.compile({
      checkpointer,
    });

    const finalState = await app.invoke(
      {
        messages: [new HumanMessage(query)],
      },
      {
        recursionLimit: 15,
        configurable: {
          thread_id,
        },
      }
    );
    //extra final message in the chain as the answer
    const finalMessage =
      finalState.messages[finalState.messages.length - 1].content;
    console.log(finalMessage);
    return finalMessage;
  } catch (err) {
    console.log(err);
  }
}

//tool that looks up employee in mongo atlas using vector searching
