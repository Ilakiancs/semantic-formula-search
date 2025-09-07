import { z } from "zod";

// Base F1 Document Schema
export const F1DocumentSchema = z.object({
  id: z.string().uuid().optional(),
  text: z.string().min(1, "Text content is required"),
  embedding: z
    .array(z.number())
    .length(1024, "Embedding must be 1024 dimensions"),
  source: z.string().min(1, "Source is required"),
  category: z.enum([
    "drivers",
    "teams",
    "constructors",
    "races",
    "race_results",
    "qualifying",
    "sprint",
    "calendar",
    "standings",
    "statistics",
    "analysis",
    "videogame_ratings",
    "driver_of_day_votes",
    "f1_data",
  ]),
  season: z.string().regex(/^\d{4}$/, "Season must be a 4-digit year"),
  track: z.string().optional(),
  driver: z.string().optional(),
  team: z.string().optional(),
  constructor: z.string().optional(),
  position: z.number().int().positive().optional(),
  points: z.number().nonnegative().optional(),
  metadata: z.record(z.any()).optional(),
  created_at: z.string().datetime().optional(),
});

// Driver Schema
export const DriverSchema = z.object({
  driver: z.string().min(1, "Driver name is required"),
  team: z.string().min(1, "Team is required"),
  constructor: z.string().optional(),
  nationality: z.string().optional(),
  points: z.number().nonnegative().default(0),
  position: z.number().int().positive().optional(),
  wins: z.number().int().nonnegative().default(0),
  podiums: z.number().int().nonnegative().default(0),
  fastest_laps: z.number().int().nonnegative().default(0),
  season: z.string().regex(/^\d{4}$/, "Season must be a 4-digit year"),
});

// Team/Constructor Schema
export const TeamSchema = z.object({
  team: z.string().min(1, "Team name is required"),
  constructor: z.string().optional(),
  points: z.number().nonnegative().default(0),
  position: z.number().int().positive().optional(),
  wins: z.number().int().nonnegative().default(0),
  podiums: z.number().int().nonnegative().default(0),
  season: z.string().regex(/^\d{4}$/, "Season must be a 4-digit year"),
  engine: z.string().optional(),
  base: z.string().optional(),
});

// Race Result Schema
export const RaceResultSchema = z.object({
  race: z.string().min(1, "Race name is required"),
  track: z.string().min(1, "Track name is required"),
  date: z.string().optional(),
  driver: z.string().min(1, "Driver name is required"),
  team: z.string().min(1, "Team is required"),
  constructor: z.string().optional(),
  position: z.union([
    z.number().int().positive(),
    z.literal("DNF"),
    z.literal("DSQ"),
    z.literal("DNS"),
  ]),
  points: z.number().nonnegative().default(0),
  laps: z.number().int().nonnegative().optional(),
  time: z.string().optional(),
  fastest_lap: z.boolean().default(false),
  season: z.string().regex(/^\d{4}$/, "Season must be a 4-digit year"),
  round: z.number().int().positive().optional(),
});

// Qualifying Result Schema
export const QualifyingResultSchema = z.object({
  race: z.string().min(1, "Race name is required"),
  track: z.string().min(1, "Track name is required"),
  driver: z.string().min(1, "Driver name is required"),
  team: z.string().min(1, "Team is required"),
  constructor: z.string().optional(),
  position: z.number().int().positive(),
  q1_time: z.string().optional(),
  q2_time: z.string().optional(),
  q3_time: z.string().optional(),
  season: z.string().regex(/^\d{4}$/, "Season must be a 4-digit year"),
  round: z.number().int().positive().optional(),
});

// Sprint Result Schema
export const SprintResultSchema = z.object({
  race: z.string().min(1, "Race name is required"),
  track: z.string().min(1, "Track name is required"),
  driver: z.string().min(1, "Driver name is required"),
  team: z.string().min(1, "Team is required"),
  constructor: z.string().optional(),
  position: z.union([
    z.number().int().positive(),
    z.literal("DNF"),
    z.literal("DSQ"),
    z.literal("DNS"),
  ]),
  points: z.number().nonnegative().default(0),
  laps: z.number().int().nonnegative().optional(),
  time: z.string().optional(),
  season: z.string().regex(/^\d{4}$/, "Season must be a 4-digit year"),
  round: z.number().int().positive().optional(),
});

// Calendar/Race Schedule Schema
export const RaceCalendarSchema = z.object({
  round: z.number().int().positive(),
  race: z.string().min(1, "Race name is required"),
  track: z.string().min(1, "Track name is required"),
  country: z.string().min(1, "Country is required"),
  date: z.string().min(1, "Date is required"),
  season: z.string().regex(/^\d{4}$/, "Season must be a 4-digit year"),
  sprint_weekend: z.boolean().default(false),
  timezone: z.string().optional(),
});

// Chat Request Schema
export const ChatRequestSchema = z.object({
  message: z
    .string()
    .min(1, "Message cannot be empty")
    .max(1000, "Message too long"),
  sessionId: z.string().uuid().optional(),
  context: z.array(z.string()).optional(),
});

// Chat Response Schema
export const ChatResponseSchema = z.object({
  response: z.string(),
  sources: z
    .array(
      z.object({
        text: z.string(),
        source: z.string(),
        category: z.string(),
        season: z.string(),
        similarity: z.number().optional(),
      }),
    )
    .optional(),
  sessionId: z.string().uuid().optional(),
  metadata: z
    .object({
      tokensUsed: z.number().optional(),
      processingTime: z.number().optional(),
      model: z.string().optional(),
    })
    .optional(),
});

// Environment Variables Schema
export const EnvSchema = z.object({
  // AWS Bedrock
  AWS_REGION: z.string().default("ap-southeast-1"),
  AWS_ACCESS_KEY_ID: z.string().min(1, "AWS Access Key ID is required"),
  AWS_SECRET_ACCESS_KEY: z.string().min(1, "AWS Secret Access Key is required"),

  // Supabase (preferred)
  SUPABASE_URL: z.string().url("Invalid Supabase URL").optional(),
  SUPABASE_ANON_KEY: z
    .string()
    .min(1, "Supabase anon key is required")
    .optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  // DataStax Astra DB (fallback)
  ASTRA_DB_APPLICATION_TOKEN: z.string().optional(),
  ASTRA_DB_API_ENDPOINT: z.string().url("Invalid Astra DB endpoint").optional(),
  ASTRA_DB_NAMESPACE: z.string().default("default_keyspace").optional(),

  // Bedrock Models
  BEDROCK_EMBEDDING_MODEL: z.string().default("cohere.embed-english-v3"),
  BEDROCK_CHAT_MODEL: z
    .string()
    .default("anthropic.claude-3-sonnet-20240229-v1:0"),

  // Feature Flags
  USE_SUPABASE: z
    .string()
    .transform((val) => val === "true")
    .default("true"),
  USE_BEDROCK_CHAT: z
    .string()
    .transform((val) => val === "true")
    .default("true"),

  // Optional
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

// Database Query Schema
export const DatabaseQuerySchema = z.object({
  query: z.string().min(1, "Query is required"),
  embedding: z
    .array(z.number())
    .length(1024, "Query embedding must be 1024 dimensions"),
  limit: z.number().int().positive().max(50).default(10),
  threshold: z.number().min(0).max(1).default(0.7),
  filters: z
    .object({
      season: z.string().optional(),
      category: z.string().optional(),
      team: z.string().optional(),
      driver: z.string().optional(),
    })
    .optional(),
});

// Embedding Generation Schema
export const EmbeddingRequestSchema = z.object({
  text: z.string().min(1, "Text is required"),
  inputType: z
    .enum(["search_document", "search_query"])
    .default("search_document"),
});

export const EmbeddingResponseSchema = z.object({
  data: z.array(
    z.object({
      embedding: z.array(z.number()).length(1024),
      index: z.number().optional(),
    }),
  ),
  model: z.string().optional(),
  usage: z
    .object({
      prompt_tokens: z.number().optional(),
      total_tokens: z.number().optional(),
    })
    .optional(),
});

// Bulk Data Operations Schema
export const BulkUploadSchema = z.object({
  documents: z.array(F1DocumentSchema).min(1, "At least one document required"),
  batchSize: z.number().int().positive().max(100).default(10),
  validateOnly: z.boolean().default(false),
});

// Data Processing Schema
export const CSVRowSchema = z.record(z.string(), z.any());

export const ProcessingOptionsSchema = z.object({
  maxRows: z.number().int().positive().default(1000),
  skipHeader: z.boolean().default(true),
  delimiter: z.string().default(","),
  encoding: z.string().default("utf8"),
  validateSchema: z.boolean().default(true),
});

// Type exports for TypeScript
export type F1Document = z.infer<typeof F1DocumentSchema>;
export type Driver = z.infer<typeof DriverSchema>;
export type Team = z.infer<typeof TeamSchema>;
export type RaceResult = z.infer<typeof RaceResultSchema>;
export type QualifyingResult = z.infer<typeof QualifyingResultSchema>;
export type SprintResult = z.infer<typeof SprintResultSchema>;
export type RaceCalendar = z.infer<typeof RaceCalendarSchema>;
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type ChatResponse = z.infer<typeof ChatResponseSchema>;
export type EnvConfig = z.infer<typeof EnvSchema>;
export type DatabaseQuery = z.infer<typeof DatabaseQuerySchema>;
export type EmbeddingRequest = z.infer<typeof EmbeddingRequestSchema>;
export type EmbeddingResponse = z.infer<typeof EmbeddingResponseSchema>;
export type BulkUpload = z.infer<typeof BulkUploadSchema>;
export type CSVRow = z.infer<typeof CSVRowSchema>;
export type ProcessingOptions = z.infer<typeof ProcessingOptionsSchema>;

// Validation helper functions
export function validateF1Document(data: unknown): F1Document {
  return F1DocumentSchema.parse(data);
}

export function validateChatRequest(data: unknown): ChatRequest {
  return ChatRequestSchema.parse(data);
}

export function validateEnvironment(
  env: Record<string, string | undefined>,
): EnvConfig {
  return EnvSchema.parse(env);
}

export function validateBulkUpload(data: unknown): BulkUpload {
  return BulkUploadSchema.parse(data);
}

// Safe validation (returns result with success/error)
export function safeValidateF1Document(data: unknown) {
  return F1DocumentSchema.safeParse(data);
}

export function safeValidateChatRequest(data: unknown) {
  return ChatRequestSchema.safeParse(data);
}

export function safeValidateEnvironment(
  env: Record<string, string | undefined>,
) {
  return EnvSchema.safeParse(env);
}

// Schema transformation helpers
export function normalizeDriverData(raw: any): Driver {
  return DriverSchema.parse({
    driver: raw.Driver || raw.driver || raw.Name,
    team: raw.Team || raw.team,
    constructor:
      raw.Team || raw.Constructor || raw["Constructor"] || raw.constructor,
    nationality: raw.Country || raw.Nationality || raw.nationality,
    points: parseFloat(raw.Points || raw.points || "0"),
    position: parseInt(raw.Position || raw.position) || undefined,
    wins: parseInt(raw.Wins || raw.wins || "0"),
    podiums: parseInt(raw.Podiums || raw.podiums || "0"),
    fastest_laps: parseInt(raw.FastestLaps || raw.fastest_laps || "0"),
    season: raw.Season || raw.season || new Date().getFullYear().toString(),
  });
}

export function normalizeTeamData(raw: any): Team {
  return TeamSchema.parse({
    team: raw.Team || raw.team || raw.Name,
    constructor:
      raw["Full Team Name"] ||
      raw.Constructor ||
      raw["Constructor"] ||
      raw.constructor,
    points: parseFloat(raw.Points || raw.points || "0"),
    position: parseInt(raw.Position || raw.position) || undefined,
    wins: parseInt(raw.Wins || raw.wins || "0"),
    podiums: parseInt(raw.Podiums || raw.podiums || "0"),
    season: raw.Season || raw.season || new Date().getFullYear().toString(),
    engine: raw["Power Unit"] || raw.Engine || raw.engine,
    base: raw.Base || raw.base,
  });
}

export function normalizeRaceResultData(raw: any): RaceResult {
  let position: RaceResult["position"];
  const posStr = (raw.Position || raw.position || "").toString().toUpperCase();

  if (posStr === "DNF" || posStr === "DSQ" || posStr === "DNS") {
    position = posStr as "DNF" | "DSQ" | "DNS";
  } else {
    position = parseInt(posStr) || 1;
  }

  return RaceResultSchema.parse({
    race: raw.Track || raw.Race || raw.race || raw.RaceName,
    track: raw.Track || raw.track || raw.Circuit,
    date: raw.Date || raw.date,
    driver: raw.Driver || raw.driver,
    team: raw.Team || raw.team,
    constructor:
      raw.Team || raw.Constructor || raw["Constructor"] || raw.constructor,
    position,
    points: parseFloat(raw.Points || raw.points || "0"),
    laps: parseInt(raw.Laps || raw.laps) || undefined,
    time: raw["Time/Retired"] || raw.Time || raw.time,
    fastest_lap:
      (raw["Set Fastest Lap"] || raw.FastestLap || raw.fastest_lap) === "Yes" ||
      (raw["Set Fastest Lap"] || raw.FastestLap || raw.fastest_lap) === "Y" ||
      raw.FastestLap === true,
    season: raw.Season || raw.season || new Date().getFullYear().toString(),
    round: parseInt(raw.Round || raw.round) || undefined,
  });
}
