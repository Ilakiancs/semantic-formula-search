// Script to recreate the collection with correct dimensions
import { DataAPIClient } from "@datastax/astra-db-ts";
import * as dotenv from 'dotenv';

dotenv.config();

const client = new DataAPIClient(process.env.ASTRA_DB_APPLICATION_TOKEN as string);
const db = client.db(process.env.ASTRA_DB_API_ENDPOINT as string);

async function recreateCollection() {
  console.log('Recreating collection with 1024 dimensions...');
  
  try {
    // Drop existing collection
    console.log('Dropping existing collection...');
    await db.dropCollection('f1gpt');
    console.log('Existing collection dropped');
  } catch (error) {
    console.log('Collection may not exist, continuing...');
  }

  // Create new collection with 1024 dimensions
  console.log('Creating new collection with 1024 dimensions...');
  const res = await db.createCollection("f1gpt", {
    vector: {
      dimension: 1024,  // Updated for Cohere embeddings
      metric: "dot_product"
    }
  });
  
  console.log('Collection created successfully with 1024 dimensions');
  console.log('Ready for dataset ingestion!');
  
  return res;
}

recreateCollection().catch(console.error);
