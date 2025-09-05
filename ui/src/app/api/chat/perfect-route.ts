// PERFECT F1 CHAT API - Uses new perfect-openai module with Bedrock Claude
import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase } from "../../../../../src/lib/db";
import { generateEmbedding, generateResponse, initializeBedrock } from "../../../../../src/lib/perfect-openai";

// Initialize Bedrock on startup
let bedrockInitialized = false;

async function ensureBedrockInitialized() {
  if (!bedrockInitialized) {
    try {
      await initializeBedrock();
      bedrockInitialized = true;
      console.log('Bedrock initialized for chat API');
    } catch (error) {
      console.warn('Bedrock initialization failed, using fallbacks:', error instanceof Error ? error.message : String(error));
      bedrockInitialized = true; // Set to true to avoid repeated attempts
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('Perfect F1 Chat API - Processing request...');
    
    // Ensure Bedrock is initialized
    await ensureBedrockInitialized();
    
    const { message } = await request.json();
    
    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    console.log(`User question: "${message}"`);

    // Generate embedding for the user's question
    console.log('Generating question embedding...');
    const embeddingResult = await generateEmbedding(message);
    
    if (!embeddingResult.data || !embeddingResult.data[0]) {
      throw new Error('Failed to generate embedding for question');
    }

    // Search for relevant context
    console.log('Searching F1 knowledge base...');
    const similarDocuments = await queryDatabase(embeddingResult.data[0].embedding);
    
    if (!similarDocuments || similarDocuments.length === 0) {
      console.log('No relevant documents found');
      return NextResponse.json({
        response: "I don't have specific information about that in my current Formula 1 knowledge base. Could you try asking about F1 drivers, races, teams, or seasons from 2013-2025?"
      });
    }

    console.log(`Found ${similarDocuments.length} relevant documents`);
    
    // Extract context from similar documents
    const context = similarDocuments.map(doc => doc.text);
    
    // Log sample context for debugging
    console.log('Sample context:', context[0]?.substring(0, 100) + '...');

    // Generate response using Bedrock Claude (with fallbacks)
    console.log('Generating response with Bedrock Claude...');
    const response = await generateResponse(message, context);

    console.log('Response generated successfully');
    console.log('Response preview:', response.substring(0, 100) + '...');

    return NextResponse.json({
      response: response,
      metadata: {
        documentsFound: similarDocuments.length,
        sources: [...new Set(similarDocuments.map(doc => doc.source || 'unknown'))],
        categories: [...new Set(similarDocuments.map(doc => doc.category || 'general'))],
        seasons: [...new Set(similarDocuments.map(doc => doc.season || 'unknown'))].sort()
      }
    });

  } catch (error) {
    console.error('Chat API error:', error);
    
    // Provide helpful error response
    return NextResponse.json({
      response: "I'm experiencing technical difficulties accessing my Formula 1 knowledge base. This might be due to AWS Bedrock regional availability. Please try again in a moment, or check if your AWS credentials and region are properly configured.",
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// Health check endpoint
export async function GET() {
  try {
    await ensureBedrockInitialized();
    
    return NextResponse.json({
      status: 'healthy',
      message: 'Perfect F1 Chat API is running',
      features: [
        'AWS Bedrock Claude chat',
        'Multi-region support', 
        'Comprehensive F1 dataset',
        'Smart fallbacks'
      ],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      status: 'degraded',
      message: 'API running with fallbacks only',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 503 });
  }
}
