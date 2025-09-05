// SIMPLE WORKING CHAT ROUTE - Direct and effective
import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase } from "../../../../../src/lib/db";
import { generateEmbedding, generateResponse } from "../../../../../src/lib/openai";

export async function POST(request: NextRequest) {
  try {
    console.log('F1 Chat - Processing request...');
    
    const { message } = await request.json();
    
    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    console.log(`Question: "${message}"`);

    // Generate embedding for the question
    const embeddingResult = await generateEmbedding(message);
    
    if (!embeddingResult.data || !embeddingResult.data[0]) {
      throw new Error('Failed to generate embedding');
    }

    // Search database
    const similarDocuments = await queryDatabase(embeddingResult.data[0].embedding);
    
    console.log(`Found ${similarDocuments.length} documents`);
    
    if (similarDocuments.length === 0) {
      return NextResponse.json({
        response: "I don't have specific information about that in my Formula 1 database. Try asking about F1 drivers, races, teams, or championships from 2013-2025."
      });
    }

    // Get context
    const context = similarDocuments.map(doc => doc.text);
    
    // Generate response
    const response = await generateResponse(message, context);

    console.log('Response generated');

    return NextResponse.json({
      response: response,
      sources: similarDocuments.length,
      categories: [...new Set(similarDocuments.map(doc => doc.category))],
      seasons: [...new Set(similarDocuments.map(doc => doc.season))]
    });

  } catch (error) {
    console.error('Chat error:', error);
    
    return NextResponse.json({
      response: "I'm having technical difficulties. Please try again.",
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'online',
    message: 'F1 Chat API is running'
  });
}
