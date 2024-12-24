import { MongoClient } from "mongodb";
import dotenv from "dotenv";
dotenv.config();

const ERR_EXIT = 1;
const ADMIN_DB = "admin";
const mongoUri = process.env.MONGODB_ATLAS_URI! as string;
const mongoClient = new MongoClient(mongoUri);

async function startServer() {
  try {
    await mongoClient.connect();
    const cmd = await mongoClient.db(ADMIN_DB).command({ ping: 1 });
    console.log(cmd);
    console.log("pinged deployment successfully", new Date().toISOString());
    //await mongoClient.close();
  } catch (err) {
    console.error(err);
    process.exit(ERR_EXIT);
  }
}

startServer();
