-- F1 RAG AI Cloud - Supabase Database Setup
-- Copy and paste this entire script into your Supabase SQL Editor

-- ============================================================================
-- STEP 1: Enable pgvector extension
-- ============================================================================

-- Enable the pgvector extension for vector operations
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- STEP 2: Create f1_documents table with vector support
-- ============================================================================

-- Create the main table for F1 documents
CREATE TABLE IF NOT EXISTS f1_documents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  text text NOT NULL,
  embedding vector(1024) NOT NULL,
  source text NOT NULL,
  category text NOT NULL,
  season text NOT NULL,
  track text,
  driver text,
  team text,
  constructor text,
  position integer,
  points numeric,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- ============================================================================
-- STEP 3: Create indexes for better performance
-- ============================================================================

-- Standard indexes for filtering
CREATE INDEX IF NOT EXISTS f1_documents_category_idx ON f1_documents (category);
CREATE INDEX IF NOT EXISTS f1_documents_season_idx ON f1_documents (season);
CREATE INDEX IF NOT EXISTS f1_documents_team_idx ON f1_documents (team);
CREATE INDEX IF NOT EXISTS f1_documents_driver_idx ON f1_documents (driver);
CREATE INDEX IF NOT EXISTS f1_documents_source_idx ON f1_documents (source);
CREATE INDEX IF NOT EXISTS f1_documents_created_at_idx ON f1_documents (created_at);

-- Vector similarity search index (IVFFlat algorithm)
CREATE INDEX IF NOT EXISTS f1_documents_embedding_idx ON f1_documents
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================================
-- STEP 4: Create search function for vector similarity
-- ============================================================================

-- Function to search documents by vector similarity with optional filters
CREATE OR REPLACE FUNCTION search_f1_documents(
  query_embedding vector(1024),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  season_filter text DEFAULT null,
  category_filter text DEFAULT null,
  team_filter text DEFAULT null,
  driver_filter text DEFAULT null
)
RETURNS TABLE (
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
LANGUAGE sql STABLE
AS $$
  SELECT
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
  FROM f1_documents
  WHERE
    1 - (f1_documents.embedding <=> query_embedding) > match_threshold
    AND (season_filter IS NULL OR f1_documents.season = season_filter)
    AND (category_filter IS NULL OR f1_documents.category = category_filter)
    AND (team_filter IS NULL OR f1_documents.team = team_filter)
    AND (driver_filter IS NULL OR f1_documents.driver = driver_filter)
  ORDER BY f1_documents.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ============================================================================
-- STEP 5: Create statistics function
-- ============================================================================

-- Function to get comprehensive F1 database statistics
CREATE OR REPLACE FUNCTION get_f1_statistics()
RETURNS jsonb
LANGUAGE sql STABLE
AS $$
  SELECT jsonb_build_object(
    'totalDocuments', count(*),
    'categories', (
      SELECT jsonb_agg(DISTINCT category ORDER BY category)
      FROM f1_documents
      WHERE category IS NOT NULL
    ),
    'seasons', (
      SELECT jsonb_agg(DISTINCT season ORDER BY season)
      FROM f1_documents
      WHERE season IS NOT NULL
    ),
    'sources', (
      SELECT jsonb_agg(DISTINCT source ORDER BY source)
      FROM f1_documents
      WHERE source IS NOT NULL
    ),
    'documentsByCategory', (
      SELECT jsonb_object_agg(category, count)
      FROM (
        SELECT category, count(*) as count
        FROM f1_documents
        WHERE category IS NOT NULL
        GROUP BY category
        ORDER BY category
      ) t
    ),
    'documentsBySeason', (
      SELECT jsonb_object_agg(season, count)
      FROM (
        SELECT season, count(*) as count
        FROM f1_documents
        WHERE season IS NOT NULL
        GROUP BY season
        ORDER BY season
      ) t
    ),
    'teams', (
      SELECT jsonb_agg(DISTINCT team ORDER BY team)
      FROM f1_documents
      WHERE team IS NOT NULL
    ),
    'drivers', (
      SELECT jsonb_agg(DISTINCT driver ORDER BY driver)
      FROM f1_documents
      WHERE driver IS NOT NULL
    )
  )
  FROM f1_documents;
$$;

-- ============================================================================
-- STEP 6: Create utility functions
-- ============================================================================

-- Function to get recent documents
CREATE OR REPLACE FUNCTION get_recent_f1_documents(limit_count int DEFAULT 10)
RETURNS TABLE (
  id uuid,
  text text,
  source text,
  category text,
  season text,
  created_at timestamp with time zone
)
LANGUAGE sql STABLE
AS $$
  SELECT
    f1_documents.id,
    f1_documents.text,
    f1_documents.source,
    f1_documents.category,
    f1_documents.season,
    f1_documents.created_at
  FROM f1_documents
  ORDER BY f1_documents.created_at DESC
  LIMIT limit_count;
$$;

-- Function to search by text (non-vector search)
CREATE OR REPLACE FUNCTION search_f1_text(
  search_term text,
  limit_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  text text,
  source text,
  category text,
  season text,
  rank real
)
LANGUAGE sql STABLE
AS $$
  SELECT
    f1_documents.id,
    f1_documents.text,
    f1_documents.source,
    f1_documents.category,
    f1_documents.season,
    ts_rank(to_tsvector('english', f1_documents.text), plainto_tsquery('english', search_term)) as rank
  FROM f1_documents
  WHERE to_tsvector('english', f1_documents.text) @@ plainto_tsquery('english', search_term)
  ORDER BY rank DESC
  LIMIT limit_count;
$$;

-- ============================================================================
-- STEP 7: Set up Row Level Security (RLS)
-- ============================================================================

-- Enable Row Level Security
ALTER TABLE f1_documents ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users (full access)
CREATE POLICY "authenticated_users_all_access" ON f1_documents
  FOR ALL USING (auth.role() = 'authenticated');

-- Create policy for anonymous users (read-only access)
CREATE POLICY "anonymous_users_read_access" ON f1_documents
  FOR SELECT USING (auth.role() = 'anon');

-- Create policy for service role (full access for API operations)
CREATE POLICY "service_role_all_access" ON f1_documents
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- STEP 8: Create helpful views
-- ============================================================================

-- View for latest F1 data by category
CREATE OR REPLACE VIEW latest_f1_by_category AS
SELECT DISTINCT ON (category)
  category,
  season,
  count(*) OVER (PARTITION BY category) as document_count,
  max(created_at) OVER (PARTITION BY category) as latest_update
FROM f1_documents
ORDER BY category, created_at DESC;

-- View for team performance summary
CREATE OR REPLACE VIEW team_performance_summary AS
SELECT
  team,
  season,
  count(*) as total_documents,
  avg(points) as avg_points,
  max(points) as max_points,
  count(DISTINCT driver) as driver_count
FROM f1_documents
WHERE team IS NOT NULL AND points IS NOT NULL
GROUP BY team, season
ORDER BY season DESC, avg_points DESC NULLS LAST;

-- ============================================================================
-- STEP 9: Test the setup
-- ============================================================================

-- Test that everything is working
DO $$
BEGIN
  -- Test vector extension
  PERFORM '[]'::vector(1024);
  RAISE NOTICE 'SUCCESS: pgvector extension is working';

  -- Test table exists
  PERFORM 1 FROM f1_documents LIMIT 1;
  RAISE NOTICE 'SUCCESS: f1_documents table is accessible';

  -- Test functions exist
  PERFORM get_f1_statistics();
  RAISE NOTICE 'SUCCESS: Functions are working';

  RAISE NOTICE '============================================';
  RAISE NOTICE 'F1 RAG AI Database Setup Complete!';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Add your AWS credentials to .env file';
  RAISE NOTICE '2. Run: npm run check-setup';
  RAISE NOTICE '3. Run: npm run ingest';
  RAISE NOTICE '4. Start UI: cd ui && npm run dev';
  RAISE NOTICE '============================================';

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ERROR in setup: %', SQLERRM;
END $$;

-- Show current database status
SELECT
  'Database Setup Summary' as status,
  (SELECT count(*) FROM f1_documents) as current_documents,
  (SELECT count(*) FROM information_schema.tables WHERE table_name = 'f1_documents') as tables_created,
  (SELECT count(*) FROM pg_extension WHERE extname = 'vector') as vector_extension_enabled;
