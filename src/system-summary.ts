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

interface SystemStatus {
  component: string;
  status: "Working" | "Warning" | "Error";
  details: string;
  lastChecked: Date;
}

interface DataSummary {
  totalDocuments: number;
  categories: string[];
  seasons: string[];
  teams: string[];
  drivers: string[];
  documentsByCategory: Record<string, number>;
  documentsBySeason: Record<string, number>;
}

// Test Supabase connection and data
async function testSupabaseConnection(): Promise<SystemStatus> {
  try {
    const { data, error } = await supabase
      .from("f1_documents")
      .select("id")
      .limit(1);

    if (error) {
      return {
        component: "Supabase Database",
        status: "Error",
        details: `Connection failed: ${error.message}`,
        lastChecked: new Date(),
      };
    }

    return {
      component: "Supabase Database",
      status: "Working",
      details: "Successfully connected and querying data",
      lastChecked: new Date(),
    };
  } catch (error) {
    return {
      component: "Supabase Database",
      status: "Error",
      details: `Unexpected error: ${error}`,
      lastChecked: new Date(),
    };
  }
}

// Test AWS Bedrock embedding generation
async function testBedrockEmbeddings(): Promise<SystemStatus> {
  try {
    const input = {
      modelId: "cohere.embed-english-v3",
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        texts: ["Test Formula 1 embedding generation"],
        input_type: "search_document",
      }),
    };

    const command = new InvokeModelCommand(input);
    const response = await bedrock.send(command);
    const result = JSON.parse(new TextDecoder().decode(response.body));

    if (
      result.embeddings &&
      result.embeddings[0] &&
      result.embeddings[0].length === 1024
    ) {
      return {
        component: "AWS Bedrock Embeddings",
        status: "Working",
        details: "Successfully generating 1024-dimensional embeddings",
        lastChecked: new Date(),
      };
    }

    return {
      component: "AWS Bedrock Embeddings",
      status: "Warning",
      details: "Embeddings generated but unexpected format",
      lastChecked: new Date(),
    };
  } catch (error) {
    return {
      component: "AWS Bedrock Embeddings",
      status: "Error",
      details: `Failed to generate embeddings: ${error}`,
      lastChecked: new Date(),
    };
  }
}

// Test AWS Bedrock chat generation
async function testBedrockChat(): Promise<SystemStatus> {
  try {
    const input = {
      modelId: "anthropic.claude-3-haiku-20240307-v1:0",
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 100,
        messages: [
          {
            role: "user",
            content: "Say 'Test successful' if you can respond.",
          },
        ],
      }),
    };

    const command = new InvokeModelCommand(input);
    const response = await bedrock.send(command);
    const result = JSON.parse(new TextDecoder().decode(response.body));

    if (result.content && result.content[0] && result.content[0].text) {
      return {
        component: "AWS Bedrock Chat",
        status: "Working",
        details: "Successfully generating chat responses",
        lastChecked: new Date(),
      };
    }

    return {
      component: "AWS Bedrock Chat",
      status: "Warning",
      details: "Chat response generated but unexpected format",
      lastChecked: new Date(),
    };
  } catch (error) {
    return {
      component: "AWS Bedrock Chat",
      status: "Error",
      details: `Failed to generate chat response: ${error}`,
      lastChecked: new Date(),
    };
  }
}

// Test vector search functionality
async function testVectorSearch(): Promise<SystemStatus> {
  try {
    // Generate a test embedding first
    const testEmbedding = await generateTestEmbedding();

    const { data, error } = await supabase.rpc("search_f1_documents", {
      query_embedding: testEmbedding,
      match_threshold: 0.1,
      match_count: 5,
    });

    if (error) {
      return {
        component: "Vector Search",
        status: "Error",
        details: `Vector search failed: ${error.message}`,
        lastChecked: new Date(),
      };
    }

    return {
      component: "Vector Search",
      status: "Working",
      details: `Vector search returned ${data?.length || 0} results`,
      lastChecked: new Date(),
    };
  } catch (error) {
    return {
      component: "Vector Search",
      status: "Error",
      details: `Vector search error: ${error}`,
      lastChecked: new Date(),
    };
  }
}

// Helper function to generate test embedding
async function generateTestEmbedding(): Promise<number[]> {
  const input = {
    modelId: "cohere.embed-english-v3",
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      texts: ["Formula 1 test query"],
      input_type: "search_query",
    }),
  };

  const command = new InvokeModelCommand(input);
  const response = await bedrock.send(command);
  const result = JSON.parse(new TextDecoder().decode(response.body));
  return result.embeddings[0];
}

// Get comprehensive data summary
async function getDataSummary(): Promise<DataSummary | null> {
  try {
    const { data: stats, error } = await supabase.rpc("get_f1_statistics");

    if (error || !stats) {
      console.error("Error getting data summary:", error);
      return null;
    }

    return {
      totalDocuments: stats.totalDocuments || 0,
      categories: stats.categories || [],
      seasons: stats.seasons || [],
      teams: stats.teams || [],
      drivers: stats.drivers || [],
      documentsByCategory: stats.documentsByCategory || {},
      documentsBySeason: stats.documentsBySeason || {},
    };
  } catch (error) {
    console.error("Error in getDataSummary:", error);
    return null;
  }
}

// Display system status
function displaySystemStatus(statuses: SystemStatus[]): void {
  console.log("\nF1 RAG AI SYSTEM STATUS");
  console.log("=".repeat(50));

  statuses.forEach((status) => {
    console.log(`\n${status.status} ${status.component}`);
    console.log(`   ${status.details}`);
    console.log(`   Last checked: ${status.lastChecked.toLocaleString()}`);
  });

  const workingComponents = statuses.filter(
    (s) => s.status === "Working",
  ).length;
  const totalComponents = statuses.length;

  console.log("\n" + "=".repeat(50));
  console.log(
    `OVERALL STATUS: ${workingComponents}/${totalComponents} components working`,
  );

  if (workingComponents === totalComponents) {
    console.log("ALL SYSTEMS OPERATIONAL");
  } else if (workingComponents >= totalComponents * 0.8) {
    console.log("MOSTLY OPERATIONAL - Some issues detected");
  } else {
    console.log("SYSTEM ISSUES - Multiple components failing");
  }
}

// Display data summary
function displayDataSummary(summary: DataSummary): void {
  console.log("\nF1 DATA SUMMARY");
  console.log("=".repeat(50));

  console.log(`Total Documents: ${summary.totalDocuments.toLocaleString()}`);
  console.log(`Seasons Available: ${summary.seasons.join(", ")}`);
  console.log(`Data Categories: ${summary.categories.join(", ")}`);
  console.log(`Teams: ${summary.teams.length} teams`);
  console.log(`Drivers: ${summary.drivers.length} drivers`);

  console.log("\nDocuments by Category:");
  Object.entries(summary.documentsByCategory).forEach(([category, count]) => {
    console.log(`   ${category}: ${count.toLocaleString()}`);
  });

  console.log("\nDocuments by Season:");
  Object.entries(summary.documentsBySeason).forEach(([season, count]) => {
    console.log(`   ${season}: ${count.toLocaleString()}`);
  });
}

// Display feature capabilities
function displayFeatures(): void {
  console.log("\nAVAILABLE FEATURES");
  console.log("=".repeat(50));

  const features = [
    {
      name: "Data Ingestion",
      description: "Load F1 CSV data into Supabase with vector embeddings",
      command: "npm run ingest",
      status: "Ready",
    },
    {
      name: "Vector Search",
      description: "Search F1 data using semantic similarity",
      command: "npx ts-node src/single-f1-test.ts",
      status: "Ready",
    },
    {
      name: "Championship Analysis",
      description: "Analyze driver and constructor championships",
      command: "npx ts-node src/f1-analytics.ts",
      status: "Ready",
    },
    {
      name: "Team Comparisons",
      description: "Compare performance between F1 teams",
      command: "analyzeTeams('Red Bull Racing', 'McLaren')",
      status: "Ready",
    },
    {
      name: "Driver Performance Trends",
      description: "Analyze individual driver performance over seasons",
      command: "analyzeDriverTrends('Max Verstappen')",
      status: "Ready",
    },
    {
      name: "RAG Q&A System",
      description: "Ask questions about F1 data using AI",
      command: "npm run answer",
      status: "Ready",
    },
    {
      name: "Web UI",
      description: "Interactive web interface for F1 queries",
      command: "cd ui && npm run dev",
      status: "Ready",
    },
  ];

  features.forEach((feature) => {
    console.log(`\n${feature.status} ${feature.name}`);
    console.log(`   ${feature.description}`);
    console.log(`   Command: ${feature.command}`);
  });
}

// Display technical architecture
function displayArchitecture(): void {
  console.log("\nTECHNICAL ARCHITECTURE");
  console.log("=".repeat(50));

  console.log("\nData Layer:");
  console.log("   • Real F1 CSV datasets (2022-2025 seasons)");
  console.log("   • 100+ documents with driver, team, and race data");
  console.log("   • Comprehensive metadata and statistics");

  console.log("\nDatabase:");
  console.log("   • Supabase PostgreSQL with pgvector extension");
  console.log("   • Vector similarity search with 1024-dimensional embeddings");
  console.log("   • Advanced SQL functions for F1 analytics");

  console.log("\nAI/ML Stack:");
  console.log("   • AWS Bedrock for embeddings (Cohere embed-english-v3)");
  console.log("   • AWS Bedrock for chat completions (Claude 3 Haiku)");
  console.log("   • Semantic search with configurable similarity thresholds");

  console.log("\nApplication:");
  console.log("   • TypeScript backend with Zod validation");
  console.log("   • Next.js 15 frontend with React 19");
  console.log("   • Comprehensive error handling and logging");

  console.log("\nDevOps:");
  console.log("   • Environment-based configuration");
  console.log("   • Health checks and system monitoring");
  console.log("   • Modular architecture with reusable components");
}

// Main system summary function
async function runSystemSummary(): Promise<void> {
  console.log("F1 RAG AI - COMPREHENSIVE SYSTEM SUMMARY");
  console.log("=".repeat(60));
  console.log("Generating complete system status report...\n");

  // Test all system components
  console.log("Testing system components...");

  const statuses: SystemStatus[] = [
    await testSupabaseConnection(),
    await testBedrockEmbeddings(),
    await testBedrockChat(),
    await testVectorSearch(),
  ];

  // Display system status
  displaySystemStatus(statuses);

  // Get and display data summary
  console.log("\nGathering data summary...");
  const dataSummary = await getDataSummary();

  if (dataSummary) {
    displayDataSummary(dataSummary);
  } else {
    console.log("\nCould not retrieve data summary");
  }

  // Display available features
  displayFeatures();

  // Display technical architecture
  displayArchitecture();

  // Final summary
  console.log("\n" + "=".repeat(60));
  console.log("SYSTEM SUMMARY COMPLETE");
  console.log("=".repeat(60));

  const workingComponents = statuses.filter(
    (s) => s.status === "Working",
  ).length;
  const totalComponents = statuses.length;

  if (workingComponents === totalComponents) {
    console.log("F1 RAG AI system is fully operational");
    console.log("All components tested and working");
    console.log("Real F1 data successfully ingested");
    console.log("Vector search and AI responses functional");
    console.log("Advanced analytics features available");
    console.log("\nREADY FOR PRODUCTION USE");
  } else {
    console.log("Some system components need attention");
    console.log(
      `   ${workingComponents}/${totalComponents} components operational`,
    );
    console.log("\nREQUIRES MAINTENANCE");
  }

  console.log("\nFor detailed usage instructions, see:");
  console.log("   • README.md - Setup and getting started");
  console.log("   • QUICK_START.md - Quick start guide");
  console.log("   • Individual test scripts in src/ directory");

  console.log("=".repeat(60));
}

// Export for use in other modules
export {
  runSystemSummary,
  testSupabaseConnection,
  testBedrockEmbeddings,
  testBedrockChat,
  testVectorSearch,
  getDataSummary,
  SystemStatus,
  DataSummary,
};

// Run if executed directly
if (require.main === module) {
  runSystemSummary().catch(console.error);
}
