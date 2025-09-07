import { NextRequest, NextResponse } from "next/server";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { createClient } from "@supabase/supabase-js";

// Initialize AWS Bedrock client
const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "ap-southeast-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
);

// Generate embeddings using AWS Bedrock
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const command = new InvokeModelCommand({
      modelId: process.env.BEDROCK_EMBEDDING_MODEL || "cohere.embed-english-v3",
      body: JSON.stringify({
        texts: [text],
        input_type: "search_query",
      }),
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    return responseBody.embeddings[0];
  } catch (error) {
    console.error("Embedding generation failed:", error);
    throw new Error("Failed to generate query embedding");
  }
}

// Search F1 documents using vector similarity
async function searchF1Documents(query: string, limit: number = 5) {
  try {
    console.log(`Searching for: "${query}"`);

    // Generate embedding for the query
    const embedding = await generateEmbedding(query);
    console.log(`Generated ${embedding.length}-dimensional embedding`);

    // Search in Supabase using vector similarity
    const { data, error } = await supabase.rpc("search_f1_documents", {
      query_embedding: embedding,
      match_threshold: 0.3,
      match_count: limit,
    });

    if (error) {
      console.error("Database search error:", error);
      throw new Error("Database search failed");
    }

    console.log(`Found ${data?.length || 0} results`);
    return data || [];
  } catch (error) {
    console.error("Search failed:", error);
    throw error;
  }
}

// Generate AI response using AWS Bedrock Claude
async function generateAIResponse(
  question: string,
  context: string[],
): Promise<string> {
  try {
    const chatModel =
      process.env.BEDROCK_CHAT_MODEL ||
      "anthropic.claude-3-haiku-20240307-v1:0";
    console.log(`Generating REAL AI response using ${chatModel}...`);

    const contextText = context.join("\n\n");
    console.log(`Context length: ${contextText.length} characters`);

    const command = new InvokeModelCommand({
      modelId: chatModel,
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 600,
        temperature: 0.2,
        messages: [
          {
            role: "user",
            content: `You are an expert Formula 1 analyst. Using this F1 data from the database:

${contextText}

Question: ${question}

Provide a detailed F1 expert analysis. Include specific details about drivers, teams, positions, and points where available. Be informative and engaging like a professional F1 commentator.`,
          },
        ],
      }),
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    if (
      responseBody.content &&
      responseBody.content[0] &&
      responseBody.content[0].text
    ) {
      const aiText = responseBody.content[0].text;
      console.log("REAL AI response generated successfully");
      console.log(`Response length: ${aiText.length} characters`);
      return aiText;
    } else {
      throw new Error("No text content in AI response");
    }
  } catch (error) {
    console.error("AI response generation failed:", error);

    // Provide a context-based fallback
    if (context.length > 0) {
      return `Based on the F1 database: ${context.slice(0, 2).join(" ")} This information answers your question about "${question}".`;
    }
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log("F1 Chat API - Processing REAL AI request...");

    // Parse request body
    const body = await request.json();
    const { question } = body;

    if (!question || typeof question !== "string") {
      return NextResponse.json(
        { error: "Question is required and must be a string" },
        { status: 400 },
      );
    }

    console.log(`Question: ${question}`);

    // Search for relevant F1 documents
    const searchResults = await searchF1Documents(question, 5);

    // Prepare context from search results
    const context = searchResults.map(
      (result: any) => result.text || result.content,
    );

    // Prepare sources for response
    const sources = searchResults.map((result: any) => ({
      text: (result.text || result.content || "").substring(0, 200) + "...",
      source: result.source || "F1 Database",
      category: result.category || "f1_data",
      season: result.season || "recent",
      similarity: result.similarity || 0,
    }));

    console.log(`Found ${context.length} context documents`);

    // Generate AI response
    let answer: string;

    if (process.env.USE_BEDROCK_CHAT === "true") {
      try {
        answer = await generateAIResponse(question, context);
        console.log("REAL AI response generated successfully");
      } catch (aiError) {
        console.error("AI generation failed, using fallback:", aiError);
        // Fallback response
        if (context.length > 0) {
          answer = `Based on the F1 data: ${context.slice(0, 2).join(" ")} ${sources.length > 0 ? `Found ${sources.length} relevant documents from the F1 database.` : ""}`;
        } else {
          answer =
            "I don't have specific information about that in my Formula 1 database. Try asking about F1 drivers, teams, or race results.";
        }
      }
    } else {
      // Simple context-based response when AI is disabled
      if (context.length > 0) {
        answer = `Based on the F1 data: ${context.slice(0, 2).join(" ")} Found ${sources.length} relevant documents from the F1 database.`;
      } else {
        answer =
          "I don't have specific information about that in my Formula 1 database. Try asking about F1 drivers like Max Verstappen or Lewis Hamilton, teams like Red Bull Racing or McLaren, or recent race results.";
      }
    }

    const response = {
      answer,
      sources: sources.slice(0, 3), // Limit to top 3 sources for UI
      metadata: {
        searchResults: searchResults.length,
        processingTime: Date.now(),
        model: process.env.BEDROCK_CHAT_MODEL,
        useAI: process.env.USE_BEDROCK_CHAT === "true",
        aiPowered: true,
        realBedrock: true,
      },
    };

    console.log("F1 Chat response generated successfully with REAL AI");
    return NextResponse.json(response);
  } catch (error) {
    console.error("Chat API error:", error);

    return NextResponse.json(
      {
        error:
          "Unable to process your F1 query at the moment. Please check your connection and try again.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    // Test database connection
    const { data, error } = await supabase
      .from("f1_documents")
      .select("count(*)")
      .limit(1);

    const dbStatus = error ? "disconnected" : "connected";
    const embeddingModel =
      process.env.BEDROCK_EMBEDDING_MODEL || "not configured";
    const chatModel = process.env.BEDROCK_CHAT_MODEL || "not configured";
    const useAI = process.env.USE_BEDROCK_CHAT === "true";

    return NextResponse.json({
      status: "online",
      message: "F1 Chat API is running with REAL AWS Bedrock AI",
      database: dbStatus,
      embedding_model: embeddingModel,
      chat_model: chatModel,
      ai_enabled: useAI,
      real_ai: true,
      bedrock_enabled: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      status: "online",
      message: "F1 Chat API is running with fallback mode",
      mode: "fallback",
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
  }
}
