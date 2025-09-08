import { queryDatabase } from "./lib/db";
import { generateEmbedding, generateResponse } from "./lib/openai";

async function askQuestion(question: string) {
  try {
    console.log("Generating embedding for question:", question);
    const embedding = await generateEmbedding(question);
    console.log("Embedding result structure:", Object.keys(embedding));
    console.log("Embedding data:", embedding.data ? "exists" : "undefined");

    if (!embedding.data || !embedding.data[0]) {
      console.error("Invalid embedding response:", embedding);
      return "Error: Failed to generate embedding";
    }

    console.log(
      "About to query database with embedding length:",
      embedding.data[0].embedding.length,
    );
    const queryRes = await queryDatabase(embedding.data[0].embedding);
    console.log("Database query results:", queryRes.length, "documents found");

    const response = await generateResponse(
      question,
      queryRes.map((doc) => doc.text),
    );

    return response;
  } catch (error) {
    console.error("Error in askQuestion:", error);
    return "Error: " + error.message;
  }
}

const question = "Tell me about Max Verstappen's performance in 2024";

askQuestion(question)
  .then((answer) => {
    console.log("\nF1 RAG AI Response:");
    console.log("========================");
    console.log(answer);
    console.log("\n");
  })
  .catch((error) => {
    console.error("Error:", error);
  });
