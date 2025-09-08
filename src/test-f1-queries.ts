import { createClient } from "@supabase/supabase-js";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { config } from "dotenv";

config();

// Initialize clients
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
);

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "ap-southeast-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Generate embedding for search queries
async function generateEmbedding(text: string): Promise<number[]> {
  const input = {
    modelId: "cohere.embed-english-v3",
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      texts: [text],
      input_type: "search_query",
    }),
  };

  try {
    const command = new InvokeModelCommand(input);
    const response = await bedrock.send(command);
    const result = JSON.parse(new TextDecoder().decode(response.body));
    return result.embeddings[0];
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw error;
  }
}

// Search F1 documents using vector similarity
async function searchF1Documents(
  query: string,
  limit: number = 5,
  threshold: number = 0.3,
): Promise<any[]> {
  try {
    console.log(`Searching for: "${query}"`);

    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);

    // Use the search function from our SQL setup
    const { data, error } = await supabase.rpc("search_f1_documents", {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: limit,
    });

    if (error) {
      console.error("Search error:", error);
      // Fallback to simple text search
      console.log("Trying fallback text search...");
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("f1_documents")
        .select("*")
        .or(
          `text.ilike.%${query}%,driver.ilike.%${query}%,team.ilike.%${query}%`,
        )
        .limit(limit);

      if (fallbackError) {
        console.error("Fallback search error:", fallbackError);
        return [];
      }

      console.log(`Found ${fallbackData?.length || 0} results (fallback)`);
      return fallbackData?.map((doc) => ({ ...doc, similarity: 0.5 })) || [];
    }

    console.log(`Found ${data?.length || 0} results`);

    // If no results with vector search, try fallback
    if (!data || data.length === 0) {
      console.log("No vector results, trying text search...");
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("f1_documents")
        .select("*")
        .or(
          `text.ilike.%${query}%,driver.ilike.%${query}%,team.ilike.%${query}%`,
        )
        .limit(limit);

      if (!fallbackError && fallbackData) {
        console.log(`Found ${fallbackData.length} results (text search)`);
        return fallbackData.map((doc) => ({ ...doc, similarity: 0.5 }));
      }
    }

    return data || [];
  } catch (error) {
    console.error("Error in search:", error);
    return [];
  }
}

// Generate AI response using retrieved documents
async function generateAIResponse(
  query: string,
  documents: any[],
): Promise<string> {
  if (documents.length === 0) {
    return "I couldn't find relevant F1 data to answer your question.";
  }

  const context = documents
    .map((doc, index) => `${index + 1}. ${doc.text}`)
    .join("\n\n");

  const prompt = `You are an expert Formula 1 analyst. Answer the following question based only on the provided F1 data context. Be specific and cite relevant details from the data.

Question: ${query}

F1 Data Context:
${context}

Answer:`;

  const input = {
    modelId: "anthropic.claude-3-haiku-20240307-v1:0",
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  };

  try {
    const command = new InvokeModelCommand(input);
    const response = await bedrock.send(command);
    const result = JSON.parse(new TextDecoder().decode(response.body));
    return result.content[0].text;
  } catch (error) {
    console.error("Error generating AI response:", error);
    return "Error generating response.";
  }
}

// Complete F1 query pipeline
async function queryF1Data(question: string): Promise<void> {
  console.log("\n" + "=".repeat(80));
  console.log(`F1 Query: ${question}`);
  console.log("=".repeat(80));

  // Search for relevant documents
  const documents = await searchF1Documents(question);

  if (documents.length > 0) {
    console.log("\nRelevant F1 Data Found:");
    documents.forEach((doc, index) => {
      console.log(
        `\n${index + 1}. [${doc.category}] ${doc.season} - ${doc.source}`,
      );
      console.log(`   Similarity: ${(doc.similarity * 100).toFixed(1)}%`);
      console.log(`   ${doc.text.substring(0, 150)}...`);
    });

    // Generate AI response
    console.log("\nAI Analysis:");
    const response = await generateAIResponse(question, documents);
    console.log(response);
  } else {
    console.log("\nNo relevant F1 data found for this query.");
  }
}

// Get database statistics
async function getDatabaseStats(): Promise<void> {
  console.log("\nF1 Database Statistics:");
  console.log("=".repeat(50));

  try {
    const { data: stats, error } = await supabase.rpc("get_f1_statistics");

    if (error) {
      console.error("Error getting stats:", error);
      return;
    }

    console.log(`Total Documents: ${stats.totalDocuments}`);
    console.log(`Seasons: ${stats.seasons?.join(", ")}`);
    console.log(`Categories: ${stats.categories?.join(", ")}`);

    if (stats.documentsByCategory) {
      console.log("\nDocuments by Category:");
      Object.entries(stats.documentsByCategory).forEach(([category, count]) => {
        console.log(`   ${category}: ${count}`);
      });
    }

    if (stats.documentsBySeason) {
      console.log("\nDocuments by Season:");
      Object.entries(stats.documentsBySeason).forEach(([season, count]) => {
        console.log(`   ${season}: ${count}`);
      });
    }

    if (stats.teams && stats.teams.length > 0) {
      console.log(
        `\nTeams: ${stats.teams.slice(0, 10).join(", ")}${stats.teams.length > 10 ? "..." : ""}`,
      );
    }

    if (stats.drivers && stats.drivers.length > 0) {
      console.log(
        `\nDrivers: ${stats.drivers.slice(0, 10).join(", ")}${stats.drivers.length > 10 ? "..." : ""}`,
      );
    }
  } catch (error) {
    console.error("Error getting database statistics:", error);
  }
}

// Team comparison analysis
async function compareTeams(team1: string, team2: string): Promise<void> {
  console.log("\n" + "=".repeat(80));
  console.log(`Team Comparison: ${team1} vs ${team2}`);
  console.log("=".repeat(80));

  // Search for documents about each team
  const team1Docs = await searchF1Documents(
    `${team1} team performance results`,
    3,
  );
  const team2Docs = await searchF1Documents(
    `${team2} team performance results`,
    3,
  );

  if (team1Docs.length > 0 || team2Docs.length > 0) {
    const allDocs = [...team1Docs, ...team2Docs];
    const question = `Compare the performance of ${team1} and ${team2} teams in Formula 1. Include details about their results, drivers, and achievements.`;

    const response = await generateAIResponse(question, allDocs);
    console.log("Comparison Analysis:");
    console.log(response);
  } else {
    console.log(`No data found for teams: ${team1} and ${team2}`);
  }
}

// Driver performance analysis
async function analyzeDriver(driverName: string): Promise<void> {
  console.log("\n" + "=".repeat(80));
  console.log(`Driver Analysis: ${driverName}`);
  console.log("=".repeat(80));

  const docs = await searchF1Documents(
    `${driverName} driver performance results`,
    5,
  );

  if (docs.length > 0) {
    const question = `Analyze ${driverName}'s Formula 1 performance. Include details about their results, team, points, and achievements.`;
    const response = await generateAIResponse(question, docs);

    console.log("Driver Analysis:");
    console.log(response);
  } else {
    console.log(`No data found for driver: ${driverName}`);
  }
}

// Season analysis
async function analyzeSeason(season: string): Promise<void> {
  console.log("\n" + "=".repeat(80));
  console.log(`Season Analysis: ${season}`);
  console.log("=".repeat(80));

  const docs = await searchF1Documents(
    `${season} Formula 1 season championship results`,
    8,
  );

  if (docs.length > 0) {
    const question = `Provide an overview of the ${season} Formula 1 season. Include information about teams, drivers, key results, and championship standings.`;
    const response = await generateAIResponse(question, docs);

    console.log("Season Analysis:");
    console.log(response);
  } else {
    console.log(`No data found for season: ${season}`);
  }
}

// Main test function
async function main() {
  console.log("F1 RAG AI - Data Analysis Test");
  console.log("==================================");

  try {
    // Get database statistics
    await getDatabaseStats();

    // Test various F1 queries
    await queryF1Data("Who won the most races in 2024?");

    await queryF1Data("What are Max Verstappen's achievements and statistics?");

    await queryF1Data("How did McLaren perform in the 2024 season?");

    await queryF1Data("Which drivers scored the most points in 2023?");

    // Team comparison
    await compareTeams("Red Bull Racing", "McLaren");

    // Driver analysis
    await analyzeDriver("Lando Norris");

    // Season analysis
    await analyzeSeason("2024");

    // Race-specific queries
    await queryF1Data("Tell me about the Bahrain Grand Prix results");

    await queryF1Data("Which teams use Mercedes engines?");

    console.log("\n" + "=".repeat(80));
    console.log("F1 Data Analysis Complete!");
    console.log("=".repeat(80));
  } catch (error) {
    console.error("Error in main function:", error);
  }
}

// Run the analysis
main().catch(console.error);
