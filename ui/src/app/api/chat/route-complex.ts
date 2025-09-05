import { NextRequest, NextResponse } from 'next/server';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import OpenAI from 'openai';

// AWS Bedrock client for embeddings and chat completions
const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'ap-southeast-1', // Singapore region
  // Will attempt to use credentials from environment variables, shared credentials file, or IAM roles
});

// OpenRouter client as fallback for chat completions
const openrouterClient = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': 'http://localhost:3000',
    'X-Title': 'F1 RAG AI'
  }
});

// Generate embeddings using AWS Bedrock Cohere Embed English V3
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const command = new InvokeModelCommand({
      modelId: 'cohere.embed-english-v3',
      body: JSON.stringify({
        texts: [text],
        input_type: 'search_document'
      })
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    return responseBody.embeddings[0];
  } catch (error) {
    console.error('AWS Bedrock Cohere embedding error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to generate embedding: ${errorMessage}`);
  }
}

// Generate response using AWS Bedrock with OpenRouter fallback
async function generateResponse(question: string, context: string[]): Promise<string> {
  try {
    console.log('Attempting AWS Bedrock chat completion...');
    const prompt = `You are a helpful Formula 1 expert. Answer questions based on the provided context. If the context doesn't contain relevant information, say so clearly.

Context:
${context.join('\n\n')}

Question: ${question}`;

    const command = new InvokeModelCommand({
      modelId: process.env.BEDROCK_CHAT_MODEL || 'anthropic.claude-3-haiku-20240307-v1:0',
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 500,
        temperature: 0.3,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      })
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    return responseBody.content[0].text || "I couldn't generate a response.";
  } catch (error) {
    console.error('AWS Bedrock chat completion error:', error);
    
    // Fallback to OpenRouter
    try {
      console.log('Falling back to OpenRouter for chat completion...');
      const prompt = `You are a helpful Formula 1 expert. Answer questions based on the provided context. If the context doesn't contain relevant information, say so clearly.

Context:
${context.join('\n\n')}

Question: ${question}`;

      const completion = await openrouterClient.chat.completions.create({
        model: 'openai/gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.3,
      });

      return completion.choices[0]?.message?.content || "I couldn't generate a response.";
    } catch (fallbackError) {
      console.error('OpenRouter fallback error:', fallbackError);
      return "I encountered an error while generating a response. Please try again.";
    }
  }
}

// Simple in-memory vector database
interface Document {
  id: string;
  text: string;
  embedding: number[];
  source: string;
}

const documents: Document[] = [];

// Initialize with F1 knowledge
let isInitialized = false;

async function initializeKnowledge() {
  if (isInitialized) return;
  
  const knowledgeBase = [
    {
      text: "Formula 1 is the highest class of international racing for open-wheel single-seater formula racing cars sanctioned by the Fédération Internationale de l'Automobile (FIA). The F1 World Championship has been one of the premier forms of racing around the world since its inaugural season in 1950.",
      source: "wikipedia"
    },
    {
      text: "George Russell is a British racing driver currently competing in Formula One for Mercedes. He previously raced for Williams from 2019 to 2021. Russell is known for his consistency and strong qualifying performances.",
      source: "wikipedia"
    },
    {
      text: "Max Verstappen is a Dutch-Belgian racing driver competing in Formula One for Red Bull Racing. He is a three-time Formula One World Champion, winning the titles in 2021, 2022, and 2023. He is known for his aggressive driving style and exceptional racecraft.",
      source: "wikipedia"
    },
    {
      text: "The Qatar Grand Prix is a Formula One motor race held at the Losail International Circuit in Qatar. The race has been controversial due to track conditions, extreme heat, and safety concerns regarding tire degradation and driver fatigue.",
      source: "wikipedia"
    },
    {
      text: "Lewis Hamilton is a British racing driver competing in Formula One for Mercedes. He is a seven-time Formula One World Champion and is widely regarded as one of the greatest drivers in the sport's history.",
      source: "wikipedia"
    },
    {
      text: "Red Bull Racing is an Austrian-British Formula One racing team. The team has been highly successful, winning multiple Constructors' Championships and Drivers' Championships with drivers like Sebastian Vettel and Max Verstappen.",
      source: "wikipedia"
    },
    {
      text: "Mercedes-AMG Petronas Formula One Team is the works Mercedes Formula One team. The team has dominated the sport in recent years, winning eight consecutive Constructors' Championships from 2014 to 2021.",
      source: "wikipedia"
    }
  ];
  
  for (const item of knowledgeBase) {
    const embedding = await generateEmbedding(item.text);
    const doc: Document = {
      id: `doc-${Date.now()}-${Math.random()}`,
      text: item.text,
      embedding: embedding,
      source: item.source
    };
    documents.push(doc);
  }
  
  isInitialized = true;
}

// Cosine similarity function
function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

// Search for similar documents
async function searchDocuments(query: string, limit: number = 3): Promise<Document[]> {
  const queryEmbedding = await generateEmbedding(query);
  const queryVector = queryEmbedding;
  
  // Calculate similarities and sort
  const similarities = documents.map(doc => ({
    doc,
    similarity: cosineSimilarity(queryVector, doc.embedding)
  }));
  
  similarities.sort((a, b) => b.similarity - a.similarity);
  return similarities.slice(0, limit).map(item => item.doc);
}

export async function POST(request: NextRequest) {
  try {
    const { question } = await request.json();
    
    if (!question) {
      return NextResponse.json(
        { error: 'Question is required' },
        { status: 400 }
      );
    }
    
    // Initialize knowledge base if needed
    await initializeKnowledge();
    
    // Find relevant documents
    const relevantDocs = await searchDocuments(question);
    
    // Generate response using OpenRouter
    const context = relevantDocs.map(doc => doc.text);
    const response = await generateResponse(question, context);
    
    return NextResponse.json({
      answer: response,
      sources: relevantDocs.map(doc => ({
        text: doc.text.substring(0, 200) + '...',
        source: doc.source
      }))
    });
    
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to process question' },
      { status: 500 }
    );
  }
}
