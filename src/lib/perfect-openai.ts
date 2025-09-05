// PERFECT F1 SYSTEM - AWS Bedrock with Claude + Multi-Region Support
// Uses Bedrock Claude for both embeddings and chat, with intelligent fallbacks

import * as dotenv from 'dotenv';
import OpenAI from 'openai';
import { BedrockRuntimeClient, InvokeModelCommand, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';

// Load environment variables
dotenv.config();

// Multiple AWS regions for better Bedrock support
const BEDROCK_REGIONS = [
  'us-east-1',    // Primary - best model availability
  'us-west-2',    // Secondary - good availability
  'eu-west-1',    // European
  'ap-southeast-1', // Asia Pacific
  'eu-central-1',  // Europe Central
  'ap-northeast-1' // Asia Pacific Northeast
];

let currentRegionIndex = 0;
let currentRegion = process.env.AWS_REGION || BEDROCK_REGIONS[currentRegionIndex];

function createBedrockClient(region?: string) {
  const useRegion = region || currentRegion;
  console.log(`Creating AWS Bedrock client for region: ${useRegion}`);
  
  return new BedrockRuntimeClient({
    region: useRegion,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

let bedrockClient = createBedrockClient();

// OpenRouter fallback
const openrouterClient = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': 'http://localhost:3000',
    'X-Title': 'Perfect F1 RAG AI'
  }
});

// Try different regions if current one fails
async function tryDifferentRegion(): Promise<boolean> {
  if (currentRegionIndex < BEDROCK_REGIONS.length - 1) {
    currentRegionIndex++;
    currentRegion = BEDROCK_REGIONS[currentRegionIndex];
    bedrockClient = createBedrockClient(currentRegion);
    console.log(`Switched to region: ${currentRegion}`);
    return true;
  }
  return false;
}

// Generate embeddings using AWS Bedrock Cohere with multi-region support
export async function generateEmbedding(text: string): Promise<any> {
  const maxRetries = BEDROCK_REGIONS.length;
  let attempts = 0;

  while (attempts < maxRetries) {
    try {
      console.log(`Generating AWS Bedrock Cohere embedding (${currentRegion})...`);
      
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
      console.error(`AWS Bedrock embedding error in ${currentRegion}:`, error.message);
      
      attempts++;
      if (attempts < maxRetries && await tryDifferentRegion()) {
        console.log(`Retrying with region ${currentRegion}...`);
        continue;
      }
      
      // If all regions fail, throw error
      throw new Error(`Failed to generate embedding in all regions: ${error.message}`);
    }
  }
}

// Generate responses using AWS Bedrock Claude with multi-region support
export async function generateResponse(question: string, context: string[]): Promise<string> {
  const maxRetries = BEDROCK_REGIONS.length;
  let attempts = 0;

  // Try Bedrock Claude in multiple regions
  while (attempts < maxRetries) {
    try {
      console.log(`Using AWS Bedrock Claude for chat (${currentRegion})...`);
      
      // Use the new Converse API for better reliability
      const converseCommand = new ConverseCommand({
        modelId: 'anthropic.claude-3-haiku-20240307-v1:0', // Fast and cost-effective
        messages: [
          {
            role: 'user',
            content: [
              {
                text: `You are an expert Formula 1 analyst with comprehensive knowledge of F1 racing, drivers, teams, and statistics.

Context information:
${context.join('\n\n')}

Question: ${question}

Please provide a detailed, accurate answer based on the context provided. Include specific details like driver names, team names, race results, dates, and statistics where relevant. If you're discussing race results, mention positions, points, and performance details.`
              }
            ]
          }
        ],
        inferenceConfig: {
          maxTokens: 800,
          temperature: 0.3,
          topP: 0.9
        }
      });

      const response = await bedrockClient.send(converseCommand);
      
      if (response.output && response.output.message && response.output.message.content) {
        const content = response.output.message.content[0];
        if ('text' in content) {
          return content.text;
        }
      }
      
      throw new Error('No text content in response');
      
    } catch (error) {
      console.error(`AWS Bedrock Claude error in ${currentRegion}:`, error.message);
      
      attempts++;
      if (attempts < maxRetries && await tryDifferentRegion()) {
        console.log(`Retrying Claude with region ${currentRegion}...`);
        continue;
      }
      
      // If Bedrock fails in all regions, try the invoke method
      if (attempts === maxRetries) {
        try {
          console.log(`Trying InvokeModel method in ${currentRegion}...`);
          
          const invokeCommand = new InvokeModelCommand({
            modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
            body: JSON.stringify({
              anthropic_version: "bedrock-2023-05-31",
              max_tokens: 800,
              temperature: 0.3,
              messages: [
                {
                  role: "user",
                  content: `You are an expert Formula 1 analyst.

Context: ${context.join('\n\n')}

Question: ${question}

Provide a detailed answer with specific F1 details.`
                }
              ]
            })
          });

          const invokeResponse = await bedrockClient.send(invokeCommand);
          const responseBody = JSON.parse(new TextDecoder().decode(invokeResponse.body));
          
          if (responseBody.content && responseBody.content[0] && responseBody.content[0].text) {
            return responseBody.content[0].text;
          }
        } catch (invokeError) {
          console.error(`InvokeModel also failed:`, invokeError.message);
        }
      }
    }
  }

  // Fallback to OpenRouter if all Bedrock attempts fail
  console.log('All Bedrock regions failed, falling back to OpenRouter...');
  
  try {
    const response = await openrouterClient.chat.completions.create({
      model: "anthropic/claude-3.5-sonnet", // Best available model on OpenRouter
      messages: [{
        role: "user",
        content: `You are an expert Formula 1 analyst with comprehensive knowledge of F1 racing.
        
Context information:
${context.join('\n\n')}

Question: ${question}

Provide a detailed, accurate answer based on the context. Include specific F1 details like driver names, team names, race results, positions, points, and dates where relevant.`
      }],
      temperature: 0.3,
      max_tokens: 800
    });

    return response.choices[0].message.content || 'No response generated';
  } catch (openrouterError) {
    console.error('OpenRouter fallback also failed:', openrouterError);
    
    // Final fallback to GPT-4o-mini
    try {
      const finalResponse = await openrouterClient.chat.completions.create({
        model: "openai/gpt-4o-mini",
        messages: [{
          role: "user",
          content: `You are a Formula 1 expert. Answer this question using the provided context:

Context: ${context.join('\n\n')}

Question: ${question}`
        }]
      });
      
      return finalResponse.choices[0].message.content || 'Unable to generate response';
    } catch (finalError) {
      console.error('All chat methods failed:', finalError);
      return 'I apologize, but I\'m having technical difficulties accessing my knowledge base right now. Please try again in a moment.';
    }
  }
}

// Test connection and find best region
export async function findBestRegion(): Promise<string> {
  console.log('Testing regions to find best Bedrock availability...');
  
  for (let i = 0; i < BEDROCK_REGIONS.length; i++) {
    const region = BEDROCK_REGIONS[i];
    console.log(`Testing region: ${region}`);
    
    try {
      const testClient = createBedrockClient(region);
      
      // Test with a simple embedding
      const command = new InvokeModelCommand({
        modelId: 'cohere.embed-english-v3',
        body: JSON.stringify({
          texts: ['test'],
          input_type: 'search_document'
        })
      });

      await testClient.send(command);
      console.log(`Region ${region} is working!`);
      
      // Set as current region
      currentRegion = region;
      currentRegionIndex = i;
      bedrockClient = testClient;
      
      return region;
    } catch (error) {
      console.log(`Region ${region} failed: ${error.message}`);
    }
  }
  
  throw new Error('No working Bedrock regions found');
}

// Initialize with best region
export async function initializeBedrock(): Promise<void> {
  try {
    const bestRegion = await findBestRegion();
    console.log(`Initialized Bedrock with region: ${bestRegion}`);
  } catch (error) {
    console.warn('Could not find working Bedrock region, will use fallbacks');
  }
}
