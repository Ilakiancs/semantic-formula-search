import { z } from "zod";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { config, getBedrockConfig } from "./config";
import {
  EmbeddingRequest,
  EmbeddingRequestSchema,
  EmbeddingResponse,
  EmbeddingResponseSchema,
} from "./schemas";

// Initialize AWS Bedrock client
const bedrockConfig = getBedrockConfig();
const bedrockClient = new BedrockRuntimeClient({
  region: bedrockConfig.region,
  credentials: {
    accessKeyId: bedrockConfig.accessKeyId,
    secretAccessKey: bedrockConfig.secretAccessKey,
  },
});

// Bedrock model configurations
const MODELS = {
  EMBEDDING: {
    COHERE_V3: "cohere.embed-english-v3",
    COHERE_MULTILINGUAL: "cohere.embed-multilingual-v3",
    TITAN_V1: "amazon.titan-embed-text-v1",
    TITAN_V2: "amazon.titan-embed-text-v2:0",
  },
  CHAT: {
    CLAUDE_3_SONNET: "anthropic.claude-3-sonnet-20240229-v1:0",
    CLAUDE_3_HAIKU: "anthropic.claude-3-haiku-20240307-v1:0",
    CLAUDE_3_5_SONNET: "anthropic.claude-3-5-sonnet-20241022-v2:0",
    LLAMA_3_1_8B: "meta.llama3-1-8b-instruct-v1:0",
    LLAMA_3_1_70B: "meta.llama3-1-70b-instruct-v1:0",
  },
} as const;

// Chat request schema
const ChatRequestSchema = z.object({
  question: z.string().min(1, "Question is required"),
  context: z.array(z.string()).optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).default(0.3),
  maxTokens: z.number().int().positive().max(4096).default(1000),
});

const ChatResponseSchema = z.object({
  response: z.string(),
  model: z.string(),
  usage: z
    .object({
      inputTokens: z.number().optional(),
      outputTokens: z.number().optional(),
      totalTokens: z.number().optional(),
    })
    .optional(),
});

type ChatRequest = z.infer<typeof ChatRequestSchema>;
type ChatResponse = z.infer<typeof ChatResponseSchema>;

// Generate embeddings using AWS Bedrock
export async function generateEmbedding(
  text: string,
  options: Partial<EmbeddingRequest> = {},
): Promise<EmbeddingResponse> {
  try {
    // Validate input
    const validatedRequest = EmbeddingRequestSchema.parse({
      text,
      ...options,
    });

    console.log(
      `Generating embedding using ${bedrockConfig.embeddingModel}...`,
    );

    let modelBody: any;
    let responseParser: (response: any) => number[];

    switch (bedrockConfig.embeddingModel) {
      case MODELS.EMBEDDING.COHERE_V3:
      case MODELS.EMBEDDING.COHERE_MULTILINGUAL:
        modelBody = {
          texts: [validatedRequest.text],
          input_type: validatedRequest.inputType,
        };
        responseParser = (response) => response.embeddings[0];
        break;

      case MODELS.EMBEDDING.TITAN_V1:
      case MODELS.EMBEDDING.TITAN_V2:
        modelBody = {
          inputText: validatedRequest.text,
        };
        responseParser = (response) => response.embedding;
        break;

      default:
        throw new Error(
          `Unsupported embedding model: ${bedrockConfig.embeddingModel}`,
        );
    }

    const command = new InvokeModelCommand({
      modelId: bedrockConfig.embeddingModel,
      body: JSON.stringify(modelBody),
      contentType: "application/json",
      accept: "application/json",
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    const embedding = responseParser(responseBody);

    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error("Invalid embedding response format");
    }

    // Validate and return in OpenAI-compatible format
    const result: EmbeddingResponse = {
      data: [
        {
          embedding,
          index: 0,
        },
      ],
      model: bedrockConfig.embeddingModel,
      usage: {
        prompt_tokens: Math.ceil(validatedRequest.text.length / 4),
        total_tokens: Math.ceil(validatedRequest.text.length / 4),
      },
    };

    const validatedResponse = EmbeddingResponseSchema.parse(result);
    console.log(`Generated ${embedding.length}-dimensional embedding`);

    return validatedResponse;
  } catch (error) {
    console.error("Embedding generation failed:", error);

    if (error instanceof z.ZodError) {
      throw new Error(
        `Validation error: ${error.errors.map((e) => e.message).join(", ")}`,
      );
    }

    if (error instanceof Error) {
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }

    throw new Error("Unknown embedding generation error");
  }
}

// Generate chat response using AWS Bedrock
export async function generateResponse(
  question: string,
  context: string[] = [],
  options: Partial<ChatRequest> = {},
): Promise<string> {
  try {
    // Validate input
    const validatedRequest = ChatRequestSchema.parse({
      question,
      context,
      ...options,
    });

    const model = validatedRequest.model || bedrockConfig.chatModel;

    console.log(`Generating response using ${model}...`);

    // Prepare the prompt
    const systemPrompt = `You are an expert Formula 1 analyst with comprehensive knowledge of F1 racing, drivers, teams, regulations, and history.

You provide accurate, detailed, and engaging responses about Formula 1 topics. Always base your answers on the provided context when available, but don't explicitly mention that you're using provided context.

Your responses should be:
- Factual and accurate
- Engaging and informative
- Well-structured and easy to read
- Focused on the specific question asked`;

    const contextText =
      validatedRequest.context && validatedRequest.context.length > 0
        ? `\n\nRelevant F1 Information:\n${validatedRequest.context.join("\n\n")}`
        : "";

    const userPrompt = `${validatedRequest.question}${contextText}`;

    let modelBody: any;
    let responseParser: (response: any) => string;

    if (model.startsWith("anthropic.claude")) {
      // Claude models
      modelBody = {
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: validatedRequest.maxTokens,
        temperature: validatedRequest.temperature,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: userPrompt,
          },
        ],
      };
      responseParser = (response) => response.content[0].text;
    } else if (model.startsWith("meta.llama")) {
      // Llama models
      const combinedPrompt = `<|begin_of_text|><|start_header_id|>system<|end_header_id|>

${systemPrompt}<|eot_id|><|start_header_id|>user<|end_header_id|>

${userPrompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>

`;

      modelBody = {
        prompt: combinedPrompt,
        max_gen_len: validatedRequest.maxTokens,
        temperature: validatedRequest.temperature,
        top_p: 0.9,
      };
      responseParser = (response) => response.generation;
    } else {
      throw new Error(`Unsupported chat model: ${model}`);
    }

    const command = new InvokeModelCommand({
      modelId: model,
      body: JSON.stringify(modelBody),
      contentType: "application/json",
      accept: "application/json",
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    const generatedText = responseParser(responseBody);

    if (!generatedText || typeof generatedText !== "string") {
      throw new Error("Invalid response format from chat model");
    }

    console.log(`Generated response (${generatedText.length} characters)`);
    return generatedText.trim();
  } catch (error) {
    console.error("Chat generation failed:", error);

    if (error instanceof z.ZodError) {
      throw new Error(
        `Validation error: ${error.errors.map((e) => e.message).join(", ")}`,
      );
    }

    if (error instanceof Error) {
      throw new Error(`Failed to generate response: ${error.message}`);
    }

    throw new Error("Unknown chat generation error");
  }
}

// Generate embeddings in batches for better performance
export async function generateBatchEmbeddings(
  texts: string[],
  batchSize: number = 5,
  options: Partial<EmbeddingRequest> = {},
): Promise<EmbeddingResponse[]> {
  if (texts.length === 0) {
    return [];
  }

  console.log(
    `Generating embeddings for ${texts.length} texts in batches of ${batchSize}...`,
  );

  const results: EmbeddingResponse[] = [];
  const errors: string[] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    console.log(
      `   Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)}`,
    );

    // Process batch items concurrently but with delay to avoid rate limits
    const batchPromises = batch.map(async (text, index) => {
      try {
        // Add small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, index * 100));
        return await generateEmbedding(text, options);
      } catch (error) {
        const errorMsg = `Text ${i + index}: ${error instanceof Error ? error.message : String(error)}`;
        errors.push(errorMsg);
        console.warn(`${errorMsg}`);
        return null;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(
      ...batchResults.filter(
        (result): result is EmbeddingResponse => result !== null,
      ),
    );

    // Add delay between batches
    if (i + batchSize < texts.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  if (errors.length > 0) {
    console.warn(`${errors.length} embeddings failed:`, errors);
  }

  console.log(
    `Successfully generated ${results.length}/${texts.length} embeddings`,
  );
  return results;
}

// Test Bedrock connection
export async function testBedrockConnection(): Promise<{
  status: "healthy" | "unhealthy";
  details: {
    embeddingModel: string;
    chatModel: string;
    embeddingTest: boolean;
    chatTest: boolean;
    error?: string;
  };
}> {
  const details = {
    embeddingModel: bedrockConfig.embeddingModel,
    chatModel: bedrockConfig.chatModel,
    embeddingTest: false,
    chatTest: false,
    error: undefined as string | undefined,
  };

  try {
    console.log("Testing Bedrock connection...");

    // Test embedding generation
    try {
      const embeddingResult = await generateEmbedding(
        "Test embedding generation",
      );
      details.embeddingTest = embeddingResult.data[0].embedding.length > 0;
      console.log("Embedding test passed");
    } catch (error) {
      console.warn("Embedding test failed:", error);
      details.error = `Embedding: ${error instanceof Error ? error.message : String(error)}`;
    }

    // Test chat generation
    try {
      const chatResult = await generateResponse("What is Formula 1?", [], {
        maxTokens: 50,
      });
      details.chatTest = chatResult.length > 0;
      console.log("Chat test passed");
    } catch (error) {
      console.warn("Chat test failed:", error);
      const chatError = `Chat: ${error instanceof Error ? error.message : String(error)}`;
      details.error = details.error
        ? `${details.error}; ${chatError}`
        : chatError;
    }

    const status =
      details.embeddingTest && details.chatTest ? "healthy" : "unhealthy";
    console.log(
      `${status === "healthy" ? "PASS" : "FAIL"} Bedrock connection test ${status}`,
    );

    return { status, details };
  } catch (error) {
    details.error = error instanceof Error ? error.message : String(error);
    console.error("❌ Bedrock connection test failed:", details.error);
    return { status: "unhealthy", details };
  }
}

// Get available models
export function getAvailableModels() {
  return {
    embedding: Object.values(MODELS.EMBEDDING),
    chat: Object.values(MODELS.CHAT),
    current: {
      embedding: bedrockConfig.embeddingModel,
      chat: bedrockConfig.chatModel,
    },
  };
}

// Export types and models
export type { ChatRequest, ChatResponse };
export { MODELS };
