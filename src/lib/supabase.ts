import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { config, getDatabaseConfig, isSupabaseConfigured } from "./config";
import {
  F1Document,
  F1DocumentSchema,
  DatabaseQuery,
  DatabaseQuerySchema,
  validateF1Document,
  safeValidateF1Document,
} from "./schemas";

// Supabase Database Schema
const SupabaseF1DocumentSchema = z.object({
  id: z.string().uuid(),
  text: z.string(),
  embedding: z.array(z.number()).length(1024),
  source: z.string(),
  category: z.string(),
  season: z.string(),
  track: z.string().nullable(),
  driver: z.string().nullable(),
  team: z.string().nullable(),
  constructor: z.string().nullable(),
  position: z.number().nullable(),
  points: z.number().nullable(),
  metadata: z.record(z.any()).nullable(),
  created_at: z.string(),
});

// Search result schema
const SearchResultSchema = z.object({
  id: z.string().uuid(),
  text: z.string(),
  source: z.string(),
  category: z.string(),
  season: z.string(),
  track: z.string().nullable(),
  driver: z.string().nullable(),
  team: z.string().nullable(),
  constructor: z.string().nullable(),
  metadata: z.record(z.any()).nullable(),
  similarity: z.number(),
});

type SupabaseF1Document = z.infer<typeof SupabaseF1DocumentSchema>;
type SearchResult = z.infer<typeof SearchResultSchema>;

// Initialize Supabase client
let supabase: SupabaseClient | null = null;

function initializeSupabase(): SupabaseClient {
  if (!supabase && isSupabaseConfigured()) {
    const dbConfig = getDatabaseConfig();
    if (dbConfig.type === "supabase") {
      supabase = createClient(dbConfig.url, dbConfig.anonKey);
      console.log("Supabase client initialized");
    }
  }

  if (!supabase) {
    throw new Error(
      "Supabase not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.",
    );
  }

  return supabase;
}

// Get Supabase client
export function getSupabaseClient(): SupabaseClient {
  return initializeSupabase();
}

// Check if Supabase is available
export function isSupabaseAvailable(): boolean {
  try {
    return isSupabaseConfigured() && !!getSupabaseClient();
  } catch {
    return false;
  }
}

// Database initialization
export async function initializeDatabase(): Promise<void> {
  if (!isSupabaseAvailable()) {
    console.log("Supabase not configured, skipping database initialization");
    return;
  }

  const client = getSupabaseClient();

  try {
    console.log("Initializing Supabase database...");

    // Check if the f1_documents table exists
    const { data: tables, error: tablesError } = await client
      .from("f1_documents")
      .select("id")
      .limit(1);

    if (tablesError && tablesError.code === "42P01") {
      console.log("Creating f1_documents table...");
      console.log("Please run the SQL setup in your Supabase dashboard:");
      console.log(getSQLSetup());
      throw new Error(
        "Database tables not found. Please run the SQL setup first.",
      );
    }

    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Database initialization failed:", error);
    throw error;
  }
}

// Insert F1 documents with validation
export async function insertF1Documents(
  documents: F1Document[],
): Promise<SupabaseF1Document[]> {
  if (!isSupabaseAvailable()) {
    throw new Error("Supabase not available");
  }

  const client = getSupabaseClient();

  // Validate all documents first
  const validatedDocuments: F1Document[] = [];
  const errors: string[] = [];

  for (let i = 0; i < documents.length; i++) {
    const result = safeValidateF1Document(documents[i]);
    if (result.success) {
      validatedDocuments.push(result.data);
    } else {
      errors.push(
        `Document ${i}: ${result.error.errors.map((e) => e.message).join(", ")}`,
      );
    }
  }

  if (errors.length > 0) {
    console.warn("Validation errors:", errors);
    if (validatedDocuments.length === 0) {
      throw new Error(`All documents failed validation: ${errors.join("; ")}`);
    }
  }

  console.log(`Inserting ${validatedDocuments.length} validated documents...`);

  // Transform for Supabase insertion
  const supabaseDocuments = validatedDocuments.map((doc) => ({
    text: doc.text,
    embedding: doc.embedding,
    source: doc.source,
    category: doc.category,
    season: doc.season,
    track: doc.track || null,
    driver: doc.driver || null,
    team: doc.team || null,
    constructor: doc.constructor || null,
    position: doc.position || null,
    points: doc.points || null,
    metadata: doc.metadata || null,
  }));

  const { data, error } = await client
    .from("f1_documents")
    .insert(supabaseDocuments)
    .select();

  if (error) {
    console.error("Error inserting documents:", error);
    throw new Error(`Failed to insert documents: ${error.message}`);
  }

  if (!data) {
    throw new Error("No data returned from insert operation");
  }

  // Validate returned data
  const validatedResults = data.map((doc) =>
    SupabaseF1DocumentSchema.parse(doc),
  );

  console.log(`Successfully inserted ${validatedResults.length} documents`);
  return validatedResults;
}

// Search F1 documents using vector similarity
export async function searchF1Documents(
  queryData: DatabaseQuery,
): Promise<SearchResult[]> {
  if (!isSupabaseAvailable()) {
    throw new Error("Supabase not available");
  }

  // Validate query
  const validatedQuery = DatabaseQuerySchema.parse(queryData);
  const client = getSupabaseClient();

  console.log(
    `Searching for: "${validatedQuery.query}" (limit: ${validatedQuery.limit})`,
  );

  try {
    const { data, error } = await client.rpc("search_f1_documents", {
      query_embedding: validatedQuery.embedding,
      match_threshold: validatedQuery.threshold,
      match_count: validatedQuery.limit,
      season_filter: validatedQuery.filters?.season || null,
      category_filter: validatedQuery.filters?.category || null,
      team_filter: validatedQuery.filters?.team || null,
      driver_filter: validatedQuery.filters?.driver || null,
    });

    if (error) {
      console.error("Search error:", error);
      throw new Error(`Search failed: ${error.message}`);
    }

    if (!data) {
      console.log("ℹ️ No results found");
      return [];
    }

    // Validate search results
    const validatedResults = data.map((item: any) =>
      SearchResultSchema.parse(item),
    );

    console.log(`Found ${validatedResults.length} results`);
    return validatedResults;
  } catch (error) {
    console.error("Search operation failed:", error);
    throw error;
  }
}

// Get F1 documents by filters
export async function getF1DocumentsByFilters(filters: {
  category?: string;
  season?: string;
  team?: string;
  driver?: string;
  limit?: number;
}): Promise<SupabaseF1Document[]> {
  if (!isSupabaseAvailable()) {
    throw new Error("Supabase not available");
  }

  const client = getSupabaseClient();
  const limit = Math.min(filters.limit || 50, 100); // Max 100 results

  let query = client.from("f1_documents").select("*").limit(limit);

  if (filters.category) {
    query = query.eq("category", filters.category);
  }

  if (filters.season) {
    query = query.eq("season", filters.season);
  }

  if (filters.team) {
    query = query.eq("team", filters.team);
  }

  if (filters.driver) {
    query = query.eq("driver", filters.driver);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching documents:", error);
    throw new Error(`Failed to fetch documents: ${error.message}`);
  }

  if (!data) {
    return [];
  }

  // Validate results
  const validatedResults = data.map((doc) =>
    SupabaseF1DocumentSchema.parse(doc),
  );
  return validatedResults;
}

// Get database statistics
export async function getF1Statistics(): Promise<{
  totalDocuments: number;
  categories: string[];
  seasons: string[];
  sources: string[];
  documentsByCategory: Record<string, number>;
  documentsBySeason: Record<string, number>;
}> {
  if (!isSupabaseAvailable()) {
    throw new Error("Supabase not available");
  }

  const client = getSupabaseClient();

  const { data, error } = await client.rpc("get_f1_statistics");

  if (error) {
    console.error("Error fetching statistics:", error);
    throw new Error(`Failed to fetch statistics: ${error.message}`);
  }

  return (
    data || {
      totalDocuments: 0,
      categories: [],
      seasons: [],
      sources: [],
      documentsByCategory: {},
      documentsBySeason: {},
    }
  );
}

// Delete all documents (for testing/reset)
export async function clearAllDocuments(): Promise<void> {
  if (!isSupabaseAvailable()) {
    throw new Error("Supabase not available");
  }

  const client = getSupabaseClient();

  console.log("Clearing all F1 documents...");

  const { error } = await client
    .from("f1_documents")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all

  if (error) {
    console.error("Error clearing documents:", error);
    throw new Error(`Failed to clear documents: ${error.message}`);
  }

  console.log("All documents cleared");
}

// Get SQL setup for Supabase
export function getSQLSetup(): string {
  return `
-- Enable the pgvector extension for vector operations
create extension if not exists vector;

-- Create the f1_documents table with vector support
create table if not exists f1_documents (
  id uuid default gen_random_uuid() primary key,
  text text not null,
  embedding vector(1024) not null,
  source text not null,
  category text not null,
  season text not null,
  track text,
  driver text,
  team text,
  constructor text,
  position integer,
  points numeric,
  metadata jsonb,
  created_at timestamp with time zone default now()
);

-- Create indexes for better performance
create index if not exists f1_documents_category_idx on f1_documents (category);
create index if not exists f1_documents_season_idx on f1_documents (season);
create index if not exists f1_documents_team_idx on f1_documents (team);
create index if not exists f1_documents_driver_idx on f1_documents (driver);
create index if not exists f1_documents_embedding_idx on f1_documents using ivfflat (embedding vector_cosine_ops);

-- Function to search documents by vector similarity with filters
create or replace function search_f1_documents(
  query_embedding vector(1024),
  match_threshold float default 0.7,
  match_count int default 10,
  season_filter text default null,
  category_filter text default null,
  team_filter text default null,
  driver_filter text default null
)
returns table (
  id uuid,
  text text,
  source text,
  category text,
  season text,
  track text,
  driver text,
  team text,
  constructor text,
  metadata jsonb,
  similarity float
)
language sql stable
as $$
  select
    f1_documents.id,
    f1_documents.text,
    f1_documents.source,
    f1_documents.category,
    f1_documents.season,
    f1_documents.track,
    f1_documents.driver,
    f1_documents.team,
    f1_documents.constructor,
    f1_documents.metadata,
    1 - (f1_documents.embedding <=> query_embedding) as similarity
  from f1_documents
  where
    1 - (f1_documents.embedding <=> query_embedding) > match_threshold
    and (season_filter is null or f1_documents.season = season_filter)
    and (category_filter is null or f1_documents.category = category_filter)
    and (team_filter is null or f1_documents.team = team_filter)
    and (driver_filter is null or f1_documents.driver = driver_filter)
  order by f1_documents.embedding <=> query_embedding
  limit match_count;
$$;

-- Function to get F1 statistics
create or replace function get_f1_statistics()
returns jsonb
language sql stable
as $$
  select jsonb_build_object(
    'totalDocuments', count(*),
    'categories', (
      select jsonb_agg(distinct category order by category)
      from f1_documents
    ),
    'seasons', (
      select jsonb_agg(distinct season order by season)
      from f1_documents
    ),
    'sources', (
      select jsonb_agg(distinct source order by source)
      from f1_documents
    ),
    'documentsByCategory', (
      select jsonb_object_agg(category, count)
      from (
        select category, count(*) as count
        from f1_documents
        group by category
        order by category
      ) t
    ),
    'documentsBySeason', (
      select jsonb_object_agg(season, count)
      from (
        select season, count(*) as count
        from f1_documents
        group by season
        order by season
      ) t
    )
  )
  from f1_documents;
$$;

-- Enable Row Level Security (RLS) for security
alter table f1_documents enable row level security;

-- Create policy to allow all operations for authenticated users
create policy "Allow all operations for authenticated users" on f1_documents
  for all using (auth.role() = 'authenticated');

-- Create policy to allow read access for anonymous users
create policy "Allow read access for anonymous users" on f1_documents
  for select using (true);
`;
}

// Health check
export async function healthCheck(): Promise<{
  status: "healthy" | "unhealthy";
  details: {
    supabaseConfigured: boolean;
    connectionWorking: boolean;
    tablesExist: boolean;
    documentsCount: number;
    error?: string;
  };
}> {
  const details = {
    supabaseConfigured: isSupabaseConfigured(),
    connectionWorking: false,
    tablesExist: false,
    documentsCount: 0,
    error: undefined as string | undefined,
  };

  if (!details.supabaseConfigured) {
    details.error = "Supabase not configured";
    return { status: "unhealthy", details };
  }

  try {
    const client = getSupabaseClient();

    // Test connection
    const { data: testData, error: testError } = await client
      .from("f1_documents")
      .select("id")
      .limit(1);

    if (testError) {
      if (testError.code === "42P01") {
        details.error = "Tables do not exist";
      } else {
        details.error = testError.message;
      }
      return { status: "unhealthy", details };
    }

    details.connectionWorking = true;
    details.tablesExist = true;

    // Get document count
    const { count, error: countError } = await client
      .from("f1_documents")
      .select("*", { count: "exact", head: true });

    if (!countError && count !== null) {
      details.documentsCount = count;
    }

    return { status: "healthy", details };
  } catch (error) {
    details.error = error instanceof Error ? error.message : String(error);
    return { status: "unhealthy", details };
  }
}

// Export types
export type { SupabaseF1Document, SearchResult };
