import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { MongoClient } from "mongodb";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { z } from "zod";
import dotenv from "dotenv";
dotenv.config();

const client = new MongoClient(process.env.MONGODB_ATLAS_URI! as string);

const llm = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0.7,
});

const EmployeeSchema = z.object({
  employee_id: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  date_of_birth: z.string(),
  address: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    postal_code: z.string(),
    country: z.string(),
  }),
  contact_details: z.object({
    email: z.string().email(),
    phone_number: z.string(),
  }),
  job_details: z.object({
    job_title: z.string(),
    department: z.string(),
    hire_date: z.string(),
    employment_type: z.string(),
    salary: z.number(),
    currency: z.string(),
  }),
  work_location: z.object({
    nearest_office: z.string(),
    is_remote: z.boolean(),
  }),
  reporting_manager: z.string().nullable(),
  skills: z.array(z.string()),
  performance_reviews: z.array(
    z.object({
      review_date: z.string(),
      rating: z.number(),
      comments: z.string(),
    })
  ),
  benefits: z.object({
    health_insurance: z.string(),
    retirement_plan: z.string(),
    paid_time_off: z.number(),
  }),
  emergency_contact: z.object({
    name: z.string(),
    relationship: z.string(),
    phone_number: z.string(),
  }),
  notes: z.string(),
});

type Employee = z.infer<typeof EmployeeSchema>;

const parser = StructuredOutputParser.fromZodSchema(z.array(EmployeeSchema));

async function generateSyntheticData(): Promise<Employee[]> {
  console.log("start -> generating synthetic data");
  const prompt = `
        You are a helpful assistant that generates employee data. Generate 10 fictional employee records.
        Each record should include the following fields:
        employee_id, first_name, last_name, date_of_birth, address, contact_details,
        job_details, work_location, reporting_manager, skills, performance_reviews, benefits,
        emergency_contact, notes.
        Ensure variety in the data and realistic values.
        ${parser.getFormatInstructions()}
      `;
  //this line is used to create a instruction from the zod schema that is passed into the LLM
  //parser.getFormatInstructions();
  console.log("generating synthetic data");

  const response = await llm.invoke(prompt);
  return parser.parse(response.content as string);
}

async function createEmployeeSummary(employee: Employee): Promise<string> {
  return new Promise((resolve) => {
    const jobDetails = `${employee.job_details.job_title} in ${employee.job_details.department}`;
    const skills = employee.skills.join(", ");
    const performanceReviews = employee.performance_reviews
      .map(
        (review) =>
          `Rated ${review.rating} on ${review.review_date}: ${review.comments}`
      )
      .join(" ");
    const basicInfo = `${employee.first_name} ${employee.last_name}, born on ${employee.date_of_birth}`;
    const workLocation = `Works at ${employee.work_location.nearest_office}, Remote: ${employee.work_location.is_remote}`;
    const notes = employee.notes;

    const summary = `${basicInfo}. Job: ${jobDetails}. Skills: ${skills}. Reviews: ${performanceReviews}. Location: ${workLocation}. Notes: ${notes}`;

    resolve(summary);
  });
}

async function seedDatabase(): Promise<void> {
  try {
    await client.connect();
    const commandResponse = await client.db("admin").command({ ping: 1 });
    console.log(commandResponse);
    const db = await client.db("hr_database");
    const collection = db.collection("employees");
    await collection.deleteMany({});
    const syntheticData = await generateSyntheticData();
    const recordWithSummaries = await Promise.all(
      syntheticData.map(async (record) => ({
        pageContent: await createEmployeeSummary(record),
        metadata: { ...record },
      }))
    );
    for (const record of recordWithSummaries) {
      await MongoDBAtlasVectorSearch.fromDocuments(
        [record],
        new OpenAIEmbeddings(),
        {
          collection,
          indexName: "vector_index",
          textKey: "embedding_text",
          embeddingKey: "embedding",
        }
      );

      console.log(
        `processed ${record.metadata.first_name}, ${record.metadata.last_name} - [${record.metadata.employee_id}]`
      );
    }
  } catch (err) {
    console.log(err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

seedDatabase()
  .then((success) => console.log(success))
  .catch((err) => console.log(err));
