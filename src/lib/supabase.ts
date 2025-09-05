// Supabase Integration for Formula 1 Data Management
// Optional alternative to DataStax Astra DB for better data management

import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

// Initialize Supabase client only if credentials are provided
export const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// Database schema for F1 data
export interface F1Document {
  id?: string;
  text: string;
  embedding: number[];
  source: string;
  category: string;
  season: string;
  track?: string;
  driver?: string;
  team?: string;
  metadata?: any;
  created_at?: string;
}

// Initialize Supabase tables
export async function initializeSupabaseTables() {
  if (!supabase) {
    console.log('Supabase not configured, skipping table initialization');
    return;
  }
  
  console.log('Initializing Supabase tables for F1 data...');
  
  // Create the f1_documents table with vector support
  const { error: tableError } = await supabase.rpc('create_f1_documents_table');
  
  if (tableError && !tableError.message.includes('already exists')) {
    console.error('Error creating table:', tableError);
    throw tableError;
  }
  
  console.log('Supabase tables initialized');
}

// Insert F1 documents with vector embeddings
export async function insertF1Documents(documents: F1Document[]) {
  if (!supabase) {
    console.log('Supabase not configured, skipping document insertion');
    return;
  }
  
  console.log(`Inserting ${documents.length} documents into Supabase...`);
  
  const { data, error } = await supabase
    .from('f1_documents')
    .insert(documents);
  
  if (error) {
    console.error('Error inserting documents:', error);
    throw error;
  }
  
  console.log(`Successfully inserted ${documents.length} documents`);
  return data;
}

// Search F1 documents using vector similarity
export async function searchF1Documents(queryEmbedding: number[], limit: number = 10) {
  if (!supabase) {
    console.log('Supabase not configured, cannot search documents');
    return [];
  }
  
  console.log('Searching F1 documents with vector similarity...');
  
  const { data, error } = await supabase.rpc('search_f1_documents', {
    query_embedding: queryEmbedding,
    match_threshold: 0.7,
    match_count: limit
  });
  
  if (error) {
    console.error('Error searching documents:', error);
    throw error;
  }
  
  return data;
}

// Get F1 documents by category
export async function getF1DocumentsByCategory(category: string, limit: number = 50) {
  if (!supabase) return [];
  
  const { data, error } = await supabase
    .from('f1_documents')
    .select('*')
    .eq('category', category)
    .limit(limit);
  
  if (error) {
    console.error('Error fetching documents by category:', error);
    throw error;
  }
  
  return data;
}

// Get F1 documents by season
export async function getF1DocumentsBySeason(season: string, limit: number = 50) {
  if (!supabase) return [];
  
  const { data, error } = await supabase
    .from('f1_documents')
    .select('*')
    .eq('season', season)
    .limit(limit);
  
  if (error) {
    console.error('Error fetching documents by season:', error);
    throw error;
  }
  
  return data;
}

// Get F1 statistics
export async function getF1Statistics() {
  if (!supabase) return null;
  
  const { data, error } = await supabase.rpc('get_f1_statistics');
  
  if (error) {
    console.error('Error fetching statistics:', error);
    throw error;
  }
  
  return data;
}

// SQL functions for Supabase (to be run in Supabase SQL editor)
export const supabaseSQL = `
-- Enable the pgvector extension
create extension if not exists vector;

-- Create the f1_documents table
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
  metadata jsonb,
  created_at timestamp with time zone default now()
);

-- Create indexes for better performance
create index if not exists f1_documents_category_idx on f1_documents (category);
create index if not exists f1_documents_season_idx on f1_documents (season);
create index if not exists f1_documents_embedding_idx on f1_documents using ivfflat (embedding vector_cosine_ops);

-- Function to search documents by vector similarity
create or replace function search_f1_documents(
  query_embedding vector(1024),
  match_threshold float default 0.7,
  match_count int default 10
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
    f1_documents.metadata,
    1 - (f1_documents.embedding <=> query_embedding) as similarity
  from f1_documents
  where 1 - (f1_documents.embedding <=> query_embedding) > match_threshold
  order by f1_documents.embedding <=> query_embedding
  limit match_count;
$$;

-- Function to get F1 statistics
create or replace function get_f1_statistics()
returns jsonb
language sql stable
as $$
  select jsonb_build_object(
    'total_documents', count(*),
    'categories', jsonb_agg(distinct category),
    'seasons', jsonb_agg(distinct season order by season),
    'sources', jsonb_agg(distinct source),
    'documents_by_category', (
      select jsonb_object_agg(category, count)
      from (
        select category, count(*) as count
        from f1_documents
        group by category
      ) t
    ),
    'documents_by_season', (
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

-- Function to create tables (for RPC call)
create or replace function create_f1_documents_table()
returns void
language sql
as $$
  -- This function is just a placeholder for the RPC call
  -- The actual table creation is handled above
$$;
`;

// Example usage and migration from DataStax
export async function migrateToSupabase() {
  console.log('Starting migration to Supabase...');
  
  try {
    // Initialize tables
    await initializeSupabaseTables();
    
    console.log('Supabase setup complete!');
    console.log('\nTo complete setup:');
    console.log('1. Copy the SQL from supabaseSQL export into your Supabase SQL editor');
    console.log('2. Add SUPABASE_URL and SUPABASE_ANON_KEY to your .env file');
    console.log('3. Update your ingestion script to use Supabase functions');
    
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

// Hybrid approach: Use both DataStax and Supabase
export async function insertToSupabase(documents: F1Document[]) {
  if (!supabase) {
    console.log('Supabase not configured, skipping Supabase insertion');
    return;
  }
  
  try {
    await insertF1Documents(documents);
    console.log('Documents also saved to Supabase');
  } catch (error) {
    console.error('Failed to save to Supabase:', error);
  }
}
