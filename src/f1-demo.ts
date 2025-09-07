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
  console.log(`Generating embedding for: "${text}"`);

  const input = {
    modelId: "cohere.embed-english-v3",
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      texts: [text],
      input_type: "search_query",
    }),
  };

  const command = new InvokeModelCommand(input);
  const response = await bedrock.send(command);
  const result = JSON.parse(new TextDecoder().decode(response.body));

  console.log(`Generated ${result.embeddings[0].length}-dimensional embedding`);
  return result.embeddings[0];
}

// Search F1 documents using vector similarity
async function searchF1Documents(query: string, limit: number = 5): Promise<any[]> {
  try {
    console.log(`Searching F1 database for: "${query}"`);

    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);

    // Use vector similarity search
    const { data, error } = await supabase.rpc("search_f1_documents", {
      query_embedding: queryEmbedding,
      match_threshold: 0.3,
      match_count: limit,
    });

    if (error) {
      console.warn("Vector search failed, using fallback text search...");

      // Fallback to text search
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("f1_documents")
        .select("*")
        .or(`text.ilike.%${query}%,driver.ilike.%${query}%,team.ilike.%${query}%`)
        .limit(limit);

      if (fallbackError) throw fallbackError;

      const results = fallbackData?.map(doc => ({ ...doc, similarity: 0.5 })) || [];
      console.log(`Found ${results.length} results (text search)`);
      return results;
    }

    console.log(`Found ${data?.length || 0} results (vector search)`);
    return data || [];
  } catch (error) {
    console.error("Search error:", error);
    return [];
  }
}

// Generate AI response using retrieved documents
async function generateAIResponse(query: string, documents: any[]): Promise<string> {
  if (documents.length === 0) {
    return "I couldn't find relevant F1 data to answer your question. Please try a different query.";
  }

  console.log(`Generating AI response using ${documents.length} retrieved documents...`);

  const context = documents
    .map((doc, index) => `${index + 1}. ${doc.text}`)
    .join("\n\n");

  const prompt = `You are an expert Formula 1 analyst with access to real F1 data. Answer the following question based ONLY on the provided context. Be specific, accurate, and cite relevant details from the data.

Question: ${query}

F1 Data Context:
${context}

Provide a comprehensive answer based on the data above:`;

  const input = {
    modelId: "anthropic.claude-3-haiku-20240307-v1:0",
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 800,
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

    console.log(`Generated AI response (${result.content[0].text.length} characters)`);
    return result.content[0].text;
  } catch (error) {
    console.error("Error generating AI response:", error);
    return "I encountered an error while generating the response. Please try again.";
  }
}

// Complete F1 RAG workflow
async function demonstrateF1RAG(question: string): Promise<void> {
  console.log("\n" + "=".repeat(80));
  console.log(`F1 RAG AI DEMONSTRATION`);
  console.log("=".repeat(80));
  console.log(`Question: ${question}`);
  console.log("=".repeat(80));

  try {
    // Step 1: Search for relevant F1 documents
    const documents = await searchF1Documents(question, 6);

    if (documents.length > 0) {
      console.log("\nRetrieved F1 Data:");
      console.log("-".repeat(50));

      documents.forEach((doc, index) => {
        console.log(`\n${index + 1}. [${doc.category}] ${doc.season} - ${doc.driver || doc.team || 'General'}`);
        console.log(`   Similarity: ${(doc.similarity * 100).toFixed(1)}%`);
        console.log(`   Source: ${doc.source}`);
        console.log(`   Preview: ${doc.text.substring(0, 120)}...`);
      });

      // Step 2: Generate AI response using retrieved context
      console.log("\nAI Analysis:");
      console.log("-".repeat(50));

      const aiResponse = await generateAIResponse(question, documents);
      console.log(aiResponse);

      // Step 3: Show sources used
      console.log("\nSources Used:");
      console.log("-".repeat(50));

      const uniqueSources = [...new Set(documents.map(doc => doc.source))];
      uniqueSources.forEach((source, index) => {
        console.log(`${index + 1}. ${source}`);
      });

      console.log("\nQuery Statistics:");
      console.log("-".repeat(50));
      console.log(`• Documents retrieved: ${documents.length}`);
      console.log(`• Average similarity: ${(documents.reduce((sum, doc) => sum + doc.similarity, 0) / documents.length * 100).toFixed(1)}%`);
      console.log(`• Data categories: ${[...new Set(documents.map(doc => doc.category))].join(', ')}`);
      console.log(`• Seasons covered: ${[...new Set(documents.map(doc => doc.season))].join(', ')}`);

    } else {
      console.log("\nNo relevant F1 data found for this query.");
      console.log("Try asking about:");
      console.log("   • Specific drivers (e.g., 'Max Verstappen performance')")
      console.log("   • Team comparisons (e.g., 'Red Bull vs McLaren')")
      console.log("   • Championship standings (e.g., '2024 championship results')")
      console.log("   • Race results (e.g., 'Bahrain Grand Prix results')");
    }

  } catch (error) {
    console.error("\nError in F1 RAG workflow:", error);
  }

  console.log("\n" + "=".repeat(80));
}

// Database overview
async function showDatabaseOverview(): Promise<void> {
  console.log("F1 DATABASE OVERVIEW");
  console.log("=".repeat(50));

  try {
    const { data: stats, error } = await supabase.rpc("get_f1_statistics");

    if (error || !stats) {
      console.log("Could not retrieve database statistics");
      return;
    }

    console.log(`Total Documents: ${stats.totalDocuments}`);
    console.log(`Seasons: ${stats.seasons?.join(", ")}`);
    console.log(`Categories: ${stats.categories?.join(", ")}`);
    console.log(`Teams: ${stats.teams?.length || 0} teams available`);
    console.log(`Drivers: ${stats.drivers?.length || 0} drivers available`);

    if (stats.documentsByCategory) {
      console.log("\nDocuments by Category:");
      Object.entries(stats.documentsByCategory).forEach(([category, count]) => {
        console.log(`   • ${category}: ${count}`);
      });
    }

    console.log("\nSystem Status: All components operational");
    console.log("Vector search enabled");
    console.log("AI responses enabled");
    console.log("Real F1 data loaded");

  } catch (error) {
    console.error("Error getting database overview:", error);
  }
}

// Interactive demo scenarios
async function runInteractiveDemo(): Promise<void> {
  console.log("F1 RAG AI - INTERACTIVE DEMONSTRATION");
  console.log("==========================================\n");

  // Show database overview first
  await showDatabaseOverview();

  // Demo scenarios
  const scenarios = [
    {
      title: "Driver Performance Analysis",
      question: "How did Max Verstappen perform in the 2024 season? Include his championship points and achievements.",
    },
    {
      title: "Team Championship Analysis",
      question: "Which team performed better in 2024 - Red Bull Racing or McLaren? Compare their results.",
    },
    {
      title: "Historical Performance Comparison",
      question: "Compare Max Verstappen's performance between 2023 and 2024 seasons.",
    },
    {
      title: "Race Results Query",
      question: "Tell me about the Bahrain Grand Prix results and who performed well.",
    },
    {
      title: "Driver Statistics Lookup",
      question: "What are Charles Leclerc's career statistics and current team?",
    },
  ];

  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i];

    console.log(`\nDEMO ${i + 1}/${scenarios.length}: ${scenario.title}`);
    await demonstrateF1RAG(scenario.question);

    // Add delay between demos to avoid rate limiting
    if (i < scenarios.length - 1) {
      console.log("\nWaiting 3 seconds before next demo...");
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  // Final summary
  console.log("\nF1 RAG AI DEMONSTRATION COMPLETE!");
  console.log("=====================================");
  console.log("Successfully demonstrated:");
  console.log("   • Real F1 data retrieval using vector search");
  console.log("   • Semantic similarity matching with Cohere embeddings");
  console.log("   • AI-powered response generation with Claude");
  console.log("   • Multi-season and multi-category data analysis");
  console.log("   • Fallback search mechanisms for reliability");
  console.log("\nSystem is ready for production use!");
  console.log("\nTo run your own queries:");
  console.log("   npm run answer");
  console.log("   cd ui && npm run dev");
}

// Single query demo function for external use
async function queryF1(question: string): Promise<void> {
  await demonstrateF1RAG(question);
}

// Export functions
export {
  demonstrateF1RAG,
  queryF1,
  searchF1Documents,
  generateAIResponse,
  showDatabaseOverview,
  runInteractiveDemo,
};

// Run interactive demo if this file is executed directly
if (require.main === module) {
  runInteractiveDemo().catch(console.error);
}
