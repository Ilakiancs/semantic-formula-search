# F1 RAG AI Cloud

A comprehensive Formula 1 data analysis system using RAG (Retrieval-Augmented Generation) with AWS Bedrock, featuring robust data validation with Zod and flexible database support.

## Features

- **Real F1 Data**: Comprehensive Formula 1 datasets from 2022-2025
- **AWS Bedrock Only**: Cohere embed-english-v3 embeddings + Claude/Llama chat models
- **Flexible Database**: Supabase (recommended) or DataStax Astra DB support
- **Type Safety**: Full Zod schema validation for all data operations
- **Modern UI**: Next.js 15 with glassmorphism design and React 19
- **Production Ready**: Comprehensive error handling, logging, and health checks

## Quick Start

### Prerequisites
- Node.js 18+
- AWS account with Bedrock access in ap-southeast-1 region
- Either Supabase account (recommended) OR DataStax Astra DB account

### Installation

```bash
# Install dependencies
npm install
cd ui && npm install

# Set up environment variables
cp env.template .env
# Fill in your AWS and database credentials

# Verify setup (comprehensive health check)
npm run check-setup

# Ingest F1 data with validation
npm run ingest

# Start the UI
cd ui && npm run dev
```

## Available Scripts

- `npm run check-setup` - Comprehensive system health check with Zod validation
- `npm run ingest` - Ingest F1 data with schema validation and batch processing
- `npm run team-analysis` - Compare Red Bull vs McLaren performance
- `npm run answer` - Run direct F1 queries using Bedrock
- `npm run recreate-collection` - Reset the database collection (if needed)

### Ingestion Options

```bash
# Quick ingestion (20 rows per file)
npm run ingest

# Custom ingestion with validation only
npm run ingest -- --validate-only --max-rows 50

# Process all files with custom batch size
npm run ingest -- --all-files --batch-size 3 --priority 3
```

## Project Structure

```
├── src/
│   ├── lib/                    # Core utilities with type safety
│   │   ├── config.ts          # Environment validation with Zod
│   │   ├── schemas.ts         # Comprehensive Zod schemas
│   │   ├── db.ts              # Unified database interface (Supabase/Astra)
│   │   ├── supabase.ts        # Supabase implementation with validation
│   │   ├── openai.ts          # AWS Bedrock (embeddings + chat)
│   │   └── scrape.ts          # Data processing utilities
│   ├── guaranteed-f1.ts       # Enhanced ingestion with batch processing
│   ├── check-setup.ts         # Comprehensive health checks
│   ├── answer.ts              # Direct query interface
│   ├── recreate-collection.ts # Database management
│   └── simple-team-query.ts   # Team performance analysis
├── ui/                        # Next.js 15 frontend with validation
├── formula1-datasets/         # F1 CSV data files (2022-2025)
├── env.template              # Environment configuration guide
└── package.json
```

## Example Queries

Once the system is running, you can ask questions like:
- "Show me Red Bull vs McLaren performance in 2024"
- "Who are the top Formula 1 drivers this season?"
- "Compare Max Verstappen and Lando Norris statistics"
- "What were the race results from the Monaco Grand Prix?"
- "Which team has the most podium finishes?"

## Technical Stack

- **Backend**: TypeScript, Node.js with full type safety
- **Validation**: Zod schemas for all data operations
- **Embeddings**: AWS Bedrock (Cohere embed-english-v3)
- **Chat**: AWS Bedrock (Claude 3 Sonnet, Llama 3.1)
- **Database**: Supabase (PostgreSQL + pgvector) or DataStax Astra DB
- **Frontend**: Next.js 15, React 19, Tailwind CSS
- **Error Handling**: Comprehensive logging and health monitoring

## Environment Variables

Copy `env.template` to `.env` and configure:

```bash
# AWS Bedrock (Required)
AWS_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key

# Database - Choose ONE:

# Option 1: Supabase (Recommended)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
USE_SUPABASE=true

# Option 2: DataStax Astra DB
# ASTRA_DB_APPLICATION_TOKEN=your_astra_token
# ASTRA_DB_API_ENDPOINT=your_astra_endpoint
# USE_SUPABASE=false

# Model Configuration
BEDROCK_EMBEDDING_MODEL=cohere.embed-english-v3
BEDROCK_CHAT_MODEL=anthropic.claude-3-sonnet-20240229-v1:0
```

## Database Setup

### Supabase Setup (Recommended)

1. Create account at [supabase.com](https://supabase.com)
2. Create new project
3. Run the SQL setup from `src/lib/supabase.ts` in your SQL editor
4. Enable pgvector extension: `CREATE EXTENSION vector;`
5. Copy URL and anon key to `.env`

### DataStax Astra DB Setup

1. Create account at [astra.datastax.com](https://astra.datastax.com)
2. Create Vector Database
3. Generate application token
4. Copy endpoint and token to `.env`

## Performance Analysis

The system provides comprehensive team performance analysis with validated data:
- Driver points and championship standings
- Team constructor analysis
- Season-over-season performance tracking
- Race-by-race detailed results
- Statistical comparisons with data integrity checks

## Key Improvements

### 🛡️ Type Safety & Validation
- **Zod schemas** for all data structures
- **Runtime validation** for API requests/responses
- **Environment variable validation** with helpful error messages
- **CSV data normalization** with error handling

### 🗄️ Flexible Database Support
- **Supabase** with PostgreSQL + pgvector (recommended)
- **DataStax Astra DB** as alternative
- **Unified interface** - switch databases without code changes
- **Health monitoring** and connection testing

### 🤖 Pure Bedrock Integration
- **No OpenRouter dependency** - AWS Bedrock only
- **Multiple model support** (Claude, Llama, Cohere)
- **Embedding generation** with batch processing
- **Error handling** and fallback strategies

### 📊 Enhanced Data Processing
- **Batch ingestion** with configurable parameters
- **Validation-only mode** for testing
- **Comprehensive logging** and progress tracking
- **CSV file validation** and error reporting

### 🔍 Production Features
- **Health checks** for all system components
- **Comprehensive setup verification**
- **Error boundaries** and graceful degradation
- **Performance monitoring** and optimization

## Troubleshooting

Run the comprehensive health check:
```bash
npm run check-setup
```

Common issues:
- **AWS access denied**: Ensure IAM user has `bedrock:InvokeModel` permission
- **Database connection failed**: Check credentials and network access
- **No F1 data found**: Ensure CSV files are in `formula1-datasets/` directory
- **Validation errors**: Check data format and schema requirements

## License

MIT License - see LICENSE file for details.
