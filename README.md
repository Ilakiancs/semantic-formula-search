# F1 RAG AI Cloud

A streamlined Formula 1 RAG (Retrieval-Augmented Generation) system using AWS Bedrock with Supabase database support.

## Features

- **AWS Bedrock Integration**: Cohere embeddings + Claude chat models
- **Supabase Database**: Vector storage and search capabilities
- **Type Safety**: Zod schema validation for all operations
- **Production Ready**: Comprehensive error handling and logging

## Quick Start

### Prerequisites
- Node.js 18+
- AWS account with Bedrock access in ap-southeast-1 region
- Supabase account

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp env.template .env
# Fill in your AWS and Supabase credentials

# Verify setup
npm run check-setup

# Ingest F1 data
npm run ingest
```

## Available Scripts

- `npm run check-setup` - System health check
- `npm run ingest` - Ingest F1 data with validation
- `npm run team-analysis` - Compare team performance
- `npm run answer` - Run direct F1 queries
- `npm run recreate-collection` - Reset database collection

## Environment Variables

Copy `env.template` to `.env` and configure:

```bash
# AWS Bedrock (Required)
AWS_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key

# Supabase (Required)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
USE_SUPABASE=true

# Models
BEDROCK_EMBEDDING_MODEL=cohere.embed-english-v3
BEDROCK_CHAT_MODEL=anthropic.claude-3-haiku-20240307-v1:0
```

## Database Setup

1. Create account at [supabase.com](https://supabase.com)
2. Create new project
3. Run SQL setup from `setup.sql` in your Supabase SQL editor
4. Copy URL and anon key to `.env`

## Example Queries

```bash
npm run answer
# Ask questions like:
# "Tell me about Max Verstappen's performance in 2024"
# "Compare Red Bull vs McLaren performance"
# "Who won the Monaco Grand Prix?"
```

## Project Structure

```
├── src/
│   ├── lib/                    # Core utilities
│   │   ├── config.ts          # Environment validation
│   │   ├── schemas.ts         # Zod schemas
│   │   ├── db.ts              # Database interface
│   │   ├── supabase.ts        # Supabase implementation
│   │   └── openai.ts          # AWS Bedrock integration
│   ├── guaranteed-f1.ts       # Data ingestion
│   ├── check-setup.ts         # Health checks
│   ├── answer.ts              # Query interface
│   ├── recreate-collection.ts # Database management
│   └── simple-team-query.ts   # Team analysis
├── ui/                        # Next.js frontend (optional)
├── formula1-datasets/         # F1 JSON data files
└── setup.sql                 # Database schema
```

## License

MIT License