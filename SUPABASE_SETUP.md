# Supabase Setup Guide for F1 RAG AI Cloud

This guide will help you set up Supabase for your F1 RAG AI Cloud project with vector search capabilities.

## 📋 Prerequisites

- Supabase account (free tier available)
- F1 RAG AI Cloud project configured with Supabase credentials

## 🚀 Quick Setup

### Step 1: Enable pgvector Extension

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Run the following command to enable the vector extension:

```sql
-- Enable the pgvector extension for vector operations
CREATE EXTENSION IF NOT EXISTS vector;
```

### Step 2: Create F1 Documents Table

Copy and paste the following SQL into the SQL Editor:

```sql
-- Create the f1_documents table with vector support
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
```

### Step 3: Create Indexes for Performance

Run these commands to create indexes for better query performance:

```sql
-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS f1_documents_category_idx ON f1_documents (category);
CREATE INDEX IF NOT EXISTS f1_documents_season_idx ON f1_documents (season);
CREATE INDEX IF NOT EXISTS f1_documents_team_idx ON f1_documents (team);
CREATE INDEX IF NOT EXISTS f1_documents_driver_idx ON f1_documents (driver);
CREATE INDEX IF NOT EXISTS f1_documents_embedding_idx ON f1_documents 
  USING ivfflat (embedding vector_cosine_ops);
```

### Step 4: Create Search Function

Create a function for vector similarity search:

```sql
-- Function to search documents by vector similarity with filters
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
```

### Step 5: Create Statistics Function

Create a function to get database statistics:

```sql
-- Function to get F1 statistics
CREATE OR REPLACE FUNCTION get_f1_statistics()
RETURNS jsonb
LANGUAGE sql STABLE
AS $$
  SELECT jsonb_build_object(
    'totalDocuments', count(*),
    'categories', (
      SELECT jsonb_agg(DISTINCT category ORDER BY category)
      FROM f1_documents
    ),
    'seasons', (
      SELECT jsonb_agg(DISTINCT season ORDER BY season)
      FROM f1_documents
    ),
    'sources', (
      SELECT jsonb_agg(DISTINCT source ORDER BY source)
      FROM f1_documents
    ),
    'documentsByCategory', (
      SELECT jsonb_object_agg(category, count)
      FROM (
        SELECT category, count(*) as count
        FROM f1_documents
        GROUP BY category
        ORDER BY category
      ) t
    ),
    'documentsBySeason', (
      SELECT jsonb_object_agg(season, count)
      FROM (
        SELECT season, count(*) as count
        FROM f1_documents
        GROUP BY season
        ORDER BY season
      ) t
    )
  )
  FROM f1_documents;
$$;
```

### Step 6: Configure Row Level Security (Optional but Recommended)

Set up security policies for your table:

```sql
-- Enable Row Level Security (RLS) for security
ALTER TABLE f1_documents ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for authenticated users
CREATE POLICY "Allow all operations for authenticated users" ON f1_documents
  FOR ALL USING (auth.role() = 'authenticated');

-- Create policy to allow read access for anonymous users
CREATE POLICY "Allow read access for anonymous users" ON f1_documents
  FOR SELECT USING (true);
```

## ✅ Verification

After running all the SQL commands, verify your setup:

1. **Check Tables**: Go to **Table Editor** and confirm the `f1_documents` table exists
2. **Check Extensions**: Go to **Database** > **Extensions** and confirm `vector` is enabled
3. **Test Functions**: You can test the functions in the SQL Editor:

```sql
-- Test the statistics function
SELECT get_f1_statistics();

-- Test search function (will return empty results initially)
SELECT * FROM search_f1_documents(
  ARRAY[0.1, 0.2, 0.3]::vector(1024), -- dummy vector
  0.5, -- threshold
  5    -- limit
);
```

## 🔧 Environment Configuration

Your `.env` file should already be configured with:

```bash
SUPABASE_URL=https://ukyqgtisqppyxfadqkk.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVreWdxdGlzdXFweXhmYWRxZGtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwOTM3MzQsImV4cCI6MjA3MjY2OTczNH0.TmK1nNJdBhPA10M5zc3DeKdO_njntCp7A5YAX0zpkho
USE_SUPABASE=true
```

## 🧪 Testing Your Setup

After completing the Supabase setup:

1. **Add your AWS credentials** to the `.env` file
2. **Run the health check**:
   ```bash
   npm run check-setup
   ```
3. **Run system tests**:
   ```bash
   npm run test-system
   ```
4. **Ingest some F1 data**:
   ```bash
   npm run ingest
   ```

## 📊 Understanding the Schema

### Table Structure

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key (auto-generated) |
| `text` | text | The searchable text content |
| `embedding` | vector(1024) | 1024-dimensional vector from AWS Bedrock |
| `source` | text | Source CSV filename |
| `category` | text | Data category (drivers, teams, races, etc.) |
| `season` | text | F1 season year |
| `track` | text | Race track name (nullable) |
| `driver` | text | Driver name (nullable) |
| `team` | text | Team name (nullable) |
| `constructor` | text | Constructor name (nullable) |
| `position` | integer | Position/ranking (nullable) |
| `points` | numeric | Championship points (nullable) |
| `metadata` | jsonb | Additional structured data |
| `created_at` | timestamp | Record creation time |

### Indexes

- **category_idx**: Fast filtering by category
- **season_idx**: Fast filtering by season
- **team_idx**: Fast filtering by team
- **driver_idx**: Fast filtering by driver
- **embedding_idx**: Vector similarity search (IVFFlat algorithm)

## 🚨 Troubleshooting

### Common Issues

1. **pgvector extension not found**
   - Ensure you've run `CREATE EXTENSION IF NOT EXISTS vector;`
   - pgvector is pre-installed on Supabase

2. **Permission denied errors**
   - Check your RLS policies
   - Ensure you're using the correct API keys

3. **Vector index creation fails**
   - Make sure you have some data in the table before creating the IVFFlat index
   - The index is created automatically when you run the setup

4. **Function creation errors**
   - Ensure you have the necessary permissions
   - Try running each function creation separately

### Performance Tips

1. **Vector Index**: The IVFFlat index improves search performance but requires tuning for large datasets
2. **Batch Inserts**: Use batch inserts for better performance when loading data
3. **Connection Pooling**: Supabase handles connection pooling automatically

## 📞 Support

If you encounter issues:

1. Check the Supabase logs in your dashboard
2. Run `npm run check-setup` for detailed diagnostics
3. Verify your environment variables are correct
4. Check that all SQL commands executed successfully

## 🎯 Next Steps

Once your Supabase setup is complete:

1. Set your AWS credentials in `.env`
2. Run `npm run check-setup` to verify everything
3. Ingest F1 data with `npm run ingest`
4. Start the UI with `cd ui && npm run dev`
5. Ask questions about Formula 1!

Your F1 RAG AI system with Supabase is now ready to use! 🏎️