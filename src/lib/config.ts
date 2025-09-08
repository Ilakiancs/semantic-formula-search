import { z } from "zod";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Environment Variables Schema
const EnvSchema = z.object({
  // AWS Bedrock Configuration
  AWS_REGION: z.string().default("ap-southeast-1"),
  AWS_ACCESS_KEY_ID: z.string().min(1, "AWS Access Key ID is required"),
  AWS_SECRET_ACCESS_KEY: z.string().min(1, "AWS Secret Access Key is required"),

  // Supabase Configuration (preferred)
  SUPABASE_URL: z.string().url("Invalid Supabase URL").optional(),
  SUPABASE_ANON_KEY: z
    .string()
    .min(1, "Supabase anon key is required")
    .optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  // DataStax Astra DB Configuration (fallback)
  ASTRA_DB_APPLICATION_TOKEN: z.string().optional(),
  ASTRA_DB_API_ENDPOINT: z.string().url("Invalid Astra DB endpoint").optional(),
  ASTRA_DB_NAMESPACE: z.string().default("default_keyspace").optional(),

  // Bedrock Model Configuration
  BEDROCK_EMBEDDING_MODEL: z.string().default("cohere.embed-english-v3"),
  BEDROCK_CHAT_MODEL: z
    .string()
    .default("anthropic.claude-3-sonnet-20240229-v1:0"),

  // Feature Flags
  USE_SUPABASE: z
    .string()
    .transform((val) => val === "true")
    .default("false"),
  USE_BEDROCK_CHAT: z
    .string()
    .transform((val) => val === "true")
    .default("true"),

  // Development/Debugging
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  DEBUG_MODE: z
    .string()
    .transform((val) => val === "true")
    .default("false"),
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
});

// Validate and parse environment variables
function validateEnvironment() {
  try {
    return EnvSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Environment validation failed:");
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join(".")}: ${err.message}`);
      });

      // Show required variables
      console.error("\nRequired environment variables:");
      console.error("  - AWS_ACCESS_KEY_ID");
      console.error("  - AWS_SECRET_ACCESS_KEY");
      console.error("\nChoose ONE database option:");
      console.error("  Option 1 (Supabase - Recommended):");
      console.error("    - SUPABASE_URL");
      console.error("    - SUPABASE_ANON_KEY");
      console.error("    - USE_SUPABASE=true");
      console.error("  Option 2 (DataStax Astra DB):");
      console.error("    - ASTRA_DB_APPLICATION_TOKEN");
      console.error("    - ASTRA_DB_API_ENDPOINT");
      console.error("    - USE_SUPABASE=false");

      process.exit(1);
    }
    throw error;
  }
}

// Export validated configuration
export const config = validateEnvironment();

// Type export
export type Config = z.infer<typeof EnvSchema>;

// Configuration validation helpers
export function isSupabaseConfigured(): boolean {
  return !!(
    config.SUPABASE_URL &&
    config.SUPABASE_ANON_KEY &&
    config.USE_SUPABASE
  );
}

export function isAstraConfigured(): boolean {
  return !!(config.ASTRA_DB_APPLICATION_TOKEN && config.ASTRA_DB_API_ENDPOINT);
}

export function getDatabaseConfig() {
  if (isSupabaseConfigured()) {
    return {
      type: "supabase" as const,
      url: config.SUPABASE_URL!,
      anonKey: config.SUPABASE_ANON_KEY!,
      serviceRoleKey: config.SUPABASE_SERVICE_ROLE_KEY,
    };
  }

  if (isAstraConfigured()) {
    return {
      type: "astra" as const,
      token: config.ASTRA_DB_APPLICATION_TOKEN!,
      endpoint: config.ASTRA_DB_API_ENDPOINT!,
      namespace: config.ASTRA_DB_NAMESPACE!,
    };
  }

  throw new Error(
    "No database configuration found. Please configure either Supabase or DataStax Astra DB.",
  );
}

export function getBedrockConfig() {
  return {
    region: config.AWS_REGION,
    accessKeyId: config.AWS_ACCESS_KEY_ID,
    secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
    embeddingModel: config.BEDROCK_EMBEDDING_MODEL,
    chatModel: config.BEDROCK_CHAT_MODEL,
    useBedrock: config.USE_BEDROCK_CHAT,
  };
}

// Logging configuration
export function getLogLevel(): "error" | "warn" | "info" | "debug" {
  return config.LOG_LEVEL;
}

export function isDebugMode(): boolean {
  return config.DEBUG_MODE;
}

export function isDevelopment(): boolean {
  return config.NODE_ENV === "development";
}

export function isProduction(): boolean {
  return config.NODE_ENV === "production";
}

// Configuration summary for debugging
export function logConfigSummary() {
  if (config.LOG_LEVEL === "debug" || config.DEBUG_MODE) {
    console.log("Configuration Summary:");
    console.log(`  Environment: ${config.NODE_ENV}`);
    console.log(`  Debug Mode: ${config.DEBUG_MODE}`);
    console.log(`  Log Level: ${config.LOG_LEVEL}`);
    console.log(`  AWS Region: ${config.AWS_REGION}`);
    console.log(
      `  Database: ${isSupabaseConfigured() ? "Supabase" : "DataStax Astra"}`,
    );
    console.log(`  Embedding Model: ${config.BEDROCK_EMBEDDING_MODEL}`);
    console.log(`  Chat Model: ${config.BEDROCK_CHAT_MODEL}`);
    console.log(`  Use Bedrock Chat: ${config.USE_BEDROCK_CHAT}`);
  }
}

// Initialize configuration logging
if (isDevelopment()) {
  logConfigSummary();
}
