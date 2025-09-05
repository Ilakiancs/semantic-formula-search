# F1 RAG AI Cloud

A comprehensive Formula 1 data analysis system using RAG (Retrieval-Augmented Generation) with AWS Bedrock and DataStax Astra DB.

## Features

- **Real F1 Data**: Comprehensive Formula 1 datasets from 2013-2025
- **AWS Bedrock Integration**: Cohere embed-english-v3 for embeddings
- **DataStax Astra DB**: Vector database for efficient similarity search
- **Modern UI**: Next.js 15 with glassmorphism design
- **Team Performance Analysis**: Compare teams like Red Bull vs McLaren

## Quick Start

### Prerequisites
- Node.js 18+
- AWS credentials configured
- DataStax Astra DB account

### Installation

```bash
# Install dependencies
npm install
cd ui && npm install

# Set up environment variables
cp .env.example .env
# Fill in your AWS and DataStax credentials

# Verify setup
npm run check-setup

# Ingest F1 data
npm run ingest

# Start the UI
cd ui && npm run dev
```

## Available Scripts

- `npm run check-setup` - Verify AWS and database connections
- `npm run recreate-collection` - Reset the database collection
- `npm run ingest` - Ingest F1 data into the database
- `npm run team-analysis` - Compare Red Bull vs McLaren performance
- `npm run answer` - Run direct F1 queries

## Project Structure

```
├── src/
│   ├── lib/                    # Core utilities
│   │   ├── db.ts              # DataStax Astra DB functions
│   │   ├── openai.ts          # AWS Bedrock embeddings
│   │   └── scrape.ts          # Data processing utilities
│   ├── answer.ts              # Direct query interface
│   ├── check-setup.ts         # Setup verification
│   ├── guaranteed-f1.ts       # Data ingestion script
│   ├── recreate-collection.ts # Database management
│   └── simple-team-query.ts   # Team performance analysis
├── ui/                        # Next.js frontend
├── formula1-datasets/         # F1 CSV data files
└── package.json
```

## Example Queries

Once the system is running, you can ask questions like:
- "Show me Red Bull vs McLaren performance"
- "Who are the top Formula 1 drivers in 2024?"
- "Compare constructor standings between seasons"
- "What were the race results from Monaco?"

## Technical Stack

- **Backend**: TypeScript, Node.js
- **Embeddings**: AWS Bedrock (Cohere embed-english-v3)
- **Vector DB**: DataStax Astra DB
- **Frontend**: Next.js 15, React, Tailwind CSS
- **Chat**: OpenRouter (GPT-4o-mini) fallback

## Environment Variables

Required environment variables in `.env`:

```
# AWS Bedrock
AWS_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key

# DataStax Astra DB
ASTRA_DB_APPLICATION_TOKEN=your_token
ASTRA_DB_API_ENDPOINT=your_endpoint
ASTRA_DB_NAMESPACE=default_keyspace

# OpenRouter (fallback)
OPENROUTER_API_KEY=your_openrouter_key
```

## Performance Analysis

The system provides comprehensive team performance analysis including:
- Driver points comparison
- Team standings
- Season-over-season performance
- Race-by-race analysis

Current data shows Red Bull Racing significantly outperforming McLaren with over 5,700 points vs McLaren's ~1,000 points across available seasons.

## License

MIT License - see LICENSE file for details.
# semantic-formula-search
