import { MongoClient } from "mongodb";
import express, { Express, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { callAgent } from "./agent";
dotenv.config();

const ERR_EXIT = 1;
const ADMIN_DB = "admin";
const mongoUri = process.env.MONGODB_ATLAS_URI! as string;
const mongoClient = new MongoClient(mongoUri);
const app: Express = express();
app.use(cors());
app.use(express.json());

async function startServer() {
  try {
    await mongoClient.connect();
    const cmd = await mongoClient.db(ADMIN_DB).command({ ping: 1 });
    console.log(cmd);
    console.log("pinged deployment successfully", new Date().toISOString());

    app.get("/", (req: Request, res: Response) => {
      res.status(200).json({
        server: "langGraph server",
        database: "mongo",
        timeStamp: new Date().toISOString(),
      });
    });

    app.post("/chat", async (req: Request, res: Response) => {
      const initialMessage = req.body.message;
      const threadId = new Date().toString();
      try {
        const response = await callAgent(mongoClient, initialMessage, threadId);
        res.status(200).json({
          response,
          threadId,
        });
      } catch (err) {
        console.log(err);
      }
    });

    app.post("/chat/:threadId", async (req: Request, res: Response) => {
      const { threaId } = req.params;
      const { message } = req.body;
      try {
        const response = await callAgent(mongoClient, message, threaId);
      } catch (err) {
        console.log(err);
      }
    });

    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      console.log(`server running ${[port]} ${new Date().toISOString()}`);
    });
  } catch (err) {
    console.error(err);
    process.exit(ERR_EXIT);
  } finally {
    console.log("close db");
    //await mongoClient.close();
  }
}

startServer();
