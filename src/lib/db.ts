import * as dotenv from 'dotenv';
import { DataAPIClient } from "@datastax/astra-db-ts";

// Load environment variables
dotenv.config();

const client = new DataAPIClient(process.env.ASTRA_DB_APPLICATION_TOKEN as string);
const db = client.db(process.env.ASTRA_DB_API_ENDPOINT as string);
const collection = db.collection('f1gpt');

export async function createCollection() {
  const res = await db.createCollection("f1gpt", {
    vector: {
      dimension: 1024,  // Updated to match AWS Bedrock Titan Text Embeddings V2
      metric: "dot_product"
    }
  });
  return res
}

export async function uploadData(data: {
  $vector: number[],
  text: string
}[]) {
  return await collection.insertMany(data);
}


export async function queryDatabase(query: number[]) {
  const res = await collection.find(null, {
    sort: {
      $vector: query
    },
    limit: 10
  }).toArray();

  return res
}