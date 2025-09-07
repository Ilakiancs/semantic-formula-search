# Migration Guide: F1 RAG AI Cloud v2.0

This guide helps you migrate from the previous version to the new architecture with Zod validation, Supabase support, and Bedrock-only integration.

## 🔄 What's New

### Major Changes
- **🛡️ Zod Validation**: All data operations now use type-safe schemas
- **🗄️ Database Options**: Choose between Supabase (recommended) or Astra DB
- **🤖 Bedrock Only**: Removed OpenRouter dependency, pure AWS Bedrock
- **📊 Enhanced Processing**: Better data ingestion with validation and batch processing
- **🔍 Health Monitoring**: Comprehensive system health checks

### Breaking Changes
- Environment variables restructured
- Database interface unified
- API response format updated
- Some scripts renamed

## 🚀 Migration Steps

### Step 1: Update Dependencies

```bash
# Install new dependencies
npm install zod @supabase/supabase-js chalk@^4.1.2

# Dependencies are already included in package.json
npm install
```

### Step 2: Update Environment Variables

**Old `.env` format:**
```bash
# Old format
ASTRA_DB_APPLICATION_TOKEN=your_token
ASTRA_DB_API_ENDPOINT=your_endpoint
ASTRA_DB_NAMESPACE=default_keyspace
AWS_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
OPENROUTER_API_KEY=your_openrouter_key  # No longer needed
```

**New `.env` format:**
```bash
# AWS Bedrock (Required)
AWS_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key

# Database - Choose ONE:

# Option 1: Supabase (Recommended for new projects)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
USE_SUPABASE=true

# Option 2: Keep using Astra DB
ASTRA_DB_APPLICATION_TOKEN=your_astra_token
ASTRA_DB_API_ENDPOINT=your_astra_endpoint
ASTRA_DB_NAMESPACE=default_keyspace
USE_SUPABASE=false

# Model Configuration
BEDROCK_EMBEDDING_MODEL=cohere.embed-english-v3
BEDROCK_CHAT_MODEL=anthropic.claude-3-sonnet-20240229-v1:0
USE_BEDROCK_CHAT=true

# Optional
NODE_ENV=development
DEBUG_MODE=false
LOG_LEVEL=info
```

### Step 3: Database Migration

#### Option A: Continue with Astra DB
Your existing Astra DB will work without changes. Set `USE_SUPABASE=false`.

#### Option B: Migrate to Supabase (Recommended)

1. **Create Supabase Project**
   ```bash
   # Sign up at https://supabase.com
   # Create new project
   # Note your project URL and anon key
   ```

2. **Set up Database Schema**
   ```sql
   -- Run this in Supabase SQL Editor
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
     constructor text,
     position integer,
     points numeric,
     metadata jsonb,
     created_at timestamp with time zone default now()
   );

   -- Create indexes
   create index if not exists f1_documents_category_idx on f1_documents (category);
   create index if not exists f1_documents_season_idx on f1_documents (season);
   create index if not exists f1_documents_team_idx on f1_documents (team);
   create index if not exists f1_documents_driver_idx on f1_documents (driver);
   create index if not exists f1_documents_embedding_idx on f1_documents using ivfflat (embedding vector_cosine_ops);
   ```

3. **Update Environment**
   ```bash
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_ANON_KEY=your_anon_key_here
   USE_SUPABASE=true
   ```

### Step 4: Verify Setup

```bash
# Run comprehensive health check
npm run check-setup

# Test system components
npm run test-system
```

### Step 5: Re-ingest Data (if needed)

If you want fresh data with enhanced validation:

```bash
# Clear existing data (optional)
# For Astra DB: npm run recreate-collection
# For Supabase: truncate in SQL editor

# Ingest with new validation
npm run ingest

# Or with custom options
npm run ingest -- --max-rows 50 --validate-only
```

## 🔧 API Changes

### Chat API Response Format

**Old format:**
```json
{
  "response": "answer text",
  "sources": 5,
  "categories": ["drivers", "teams"],
  "seasons": ["2023", "2024"]
}
```

**New format:**
```json
{
  "answer": "answer text",
  "sources": [
    {
      "text": "source text snippet",
      "source": "filename.csv",
      "category": "drivers",
      "season": "2024",
      "similarity": 0.85
    }
  ],
  "metadata": {
    "documentsFound": 5,
    "databaseProvider": "Supabase",
    "processingTime": 1250,
    "model": "AWS Bedrock"
  }
}
```

### Error Response Format

**New standardized errors:**
```json
{
  "error": "Validation failed",
  "details": "message: Message is required",
  "code": "VALIDATION_ERROR"
}
```

## 📝 Script Changes

### Updated Scripts

| Old Script | New Script | Notes |
|------------|------------|-------|
| `npm run ingest` | `npm run ingest` | Enhanced with validation |
| `npm run check-setup` | `npm run check-setup` | Comprehensive health checks |
| *(new)* | `npm run test-system` | System component testing |

### New Ingestion Options

```bash
# Basic ingestion (20 rows per file)
npm run ingest

# Validation only (no database changes)
npm run ingest -- --validate-only

# Custom row limits and batch size
npm run ingest -- --max-rows 100 --batch-size 3

# Process all files regardless of priority
npm run ingest -- --all-files --priority 3

# Add delay between batches (rate limiting)
npm run ingest -- --delay 2000
```

## 🔍 New Features

### 1. Comprehensive Health Checks
```bash
npm run check-setup
```
Checks:
- Environment variable validation
- AWS Bedrock connectivity
- Database connection and health
- F1 data file availability
- Dependencies and Node.js version

### 2. System Testing
```bash
npm run test-system
```
Tests:
- Schema validation
- Embedding generation
- Chat response generation
- Database operations
- End-to-end workflow

### 3. Enhanced Data Validation
- All CSV data validated against Zod schemas
- Better error messages and debugging
- Data normalization and cleaning
- Comprehensive logging

### 4. Flexible Database Support
- Unified interface for both database types
- Automatic provider selection
- Health monitoring for both systems
- Easy switching between providers

## 🚨 Troubleshooting

### Common Migration Issues

1. **Environment Validation Errors**
   ```bash
   npm run check-setup
   # Follow the fix suggestions provided
   ```

2. **Database Connection Issues**
   - For Supabase: Verify URL and key format
   - For Astra DB: Check token and endpoint validity
   - Ensure network connectivity

3. **AWS Bedrock Access Denied**
   ```bash
   # Ensure IAM user has bedrock:InvokeModel permission
   # Verify region is ap-southeast-1
   # Check credentials are correctly set
   ```

4. **OpenRouter References**
   - Remove `OPENROUTER_API_KEY` from `.env`
   - All chat responses now use Bedrock
   - Update any custom code referencing OpenRouter

5. **Data Format Issues**
   ```bash
   # Run validation-only ingestion first
   npm run ingest -- --validate-only
   # Review error messages and fix data issues
   ```

### Getting Help

1. **Check System Health**
   ```bash
   npm run check-setup
   npm run test-system
   ```

2. **Enable Debug Mode**
   ```bash
   # In .env file
   DEBUG_MODE=true
   LOG_LEVEL=debug
   ```

3. **Review Logs**
   - Check `f1-ingestion-log.json` for ingestion details
   - Monitor console output for error messages
   - Use browser developer tools for UI issues

## 🎯 Next Steps

After successful migration:

1. **Test the System**
   ```bash
   npm run test-system
   npm run team-analysis
   npm run answer
   ```

2. **Start the UI**
   ```bash
   cd ui && npm run dev
   ```

3. **Explore New Features**
   - Enhanced data validation
   - Better error handling
   - Comprehensive health monitoring
   - Flexible database options

## 📚 Resources

- [Environment Template](./env.template) - Complete configuration guide
- [Supabase Setup](./src/lib/supabase.ts) - Database schema and functions
- [Schema Documentation](./src/lib/schemas.ts) - All Zod schemas
- [Health Check Guide](./src/check-setup.ts) - System verification

---

**Need help?** Run `npm run check-setup` for detailed diagnostics and fix suggestions.