// Generate vector embeddings using AWS Bedrock Cohere and chat completions with fallback

import * as dotenv from 'dotenv';
import OpenAI from 'openai';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

// Load environment variables
dotenv.config();

// AWS Bedrock client for embeddings
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
export async function generateEmbedding(text: string) {
  try {
    console.log('Generating AWS Bedrock Cohere embedding...');
    
    const command = new InvokeModelCommand({
      modelId: 'cohere.embed-english-v3',
      body: JSON.stringify({
        texts: [text],
        input_type: 'search_document'
      })
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    // Return in OpenAI format for compatibility
    return {
      data: [{
        embedding: responseBody.embeddings[0]
      }]
    };
  } catch (error) {
    console.error('AWS Bedrock Cohere embedding error:', error);
    throw new Error(`Failed to generate embedding: ${error.message}`);
  }
}

export async function generateResponse(question: string, context: string[]) {
  try {
    // Try Bedrock first if configured
    if (process.env.BEDROCK_CHAT_MODEL && process.env.USE_BEDROCK_CHAT === 'true') {
      console.log('Attempting Bedrock chat completion...');
      const prompt = `You are an expert in Formula 1 racing.
You need to answer this question using the context provided.
Do not mention that you have been provided with the context.

Context: ${context.join('\n\n')}

QUESTION: ${question}`;

      const command = new InvokeModelCommand({
        modelId: process.env.BEDROCK_CHAT_MODEL,
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
      
      return responseBody.content[0].text;
    }
  } catch (error) {
    console.warn('Bedrock chat failed, falling back to OpenRouter:', error.message);
  }

  // Fallback to OpenRouter
  console.log('Using OpenRouter for chat completion...');
  const response = await openrouterClient.chat.completions.create({
    model: "openai/gpt-4o-mini",
    messages: [{
      role: "user",
      content: `You are an expert in Formula 1 racing.
      You need to answer this question using the context provided.
      Do not mention that you have been provided with the context.
      
      Context: ${context.join('\n\n')}
      
      QUESTION: ${question}.
      `
    }]
  });

  return response.choices[0].message.content;
}