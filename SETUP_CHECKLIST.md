# F1 RAG AI Cloud - Complete Setup Checklist

This checklist will guide you through setting up your F1 RAG AI Cloud system step by step.

## Pre-Setup Requirements

- [ ] Node.js 18+ installed
- [ ] Git repository cloned
- [ ] Dependencies installed (`npm install`)

## Step 1: AWS Setup (Required)

### 1.1 Create AWS Account & Enable Bedrock
- [ ] AWS account created/available
- [ ] Login to AWS Console
- [ ] Navigate to Bedrock service
- [ ] **Important**: Switch to `ap-southeast-1` (Singapore) region
- [ ] Request access to models if needed:
  - [ ] Cohere Embed English v3
  - [ ] Claude 3 Sonnet
- [ ] Verify models are available in Bedrock Model Access

### 1.2 Create IAM User for Bedrock
- [ ] Go to IAM → Users → Create User
- [ ] Username: `f1-rag-bedrock-user` (or similar)
- [ ] Attach policy: Create custom policy with these permissions:
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "bedrock:InvokeModel",
                "bedrock:InvokeModelWithResponseStream"
            ],
            "Resource": "*"
        }
    ]
}
```
- [ ] Create access keys for programmatic access
- [ ] **Save access key ID and secret key safely**

### 1.3 Update Environment File
- [ ] Copy access key ID to `.env` → `AWS_ACCESS_KEY_ID`
- [ ] Copy secret access key to `.env` → `AWS_SECRET_ACCESS_KEY`
- [ ] Verify region is set to `ap-southeast-1`

## Step 2: Database Setup (Choose ONE option)

### Option A: Supabase Setup (Recommended)

#### 2A.1 Create Supabase Project
- [ ] Go to [supabase.com](https://supabase.com)
- [ ] Create account/login
- [ ] Create new project
- [ ] Choose region closest to you
- [ ] Wait for project to initialize (~2-3 minutes)

#### 2A.2 Configure Supabase Database
- [ ] Open your Supabase project dashboard
- [ ] Go to SQL Editor (left sidebar)
- [ ] Run this command first:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```
- [ ] Verify success (green checkmark)
- [ ] Copy ALL SQL commands from `SUPABASE_SETUP.md`
- [ ] Paste and execute in SQL Editor
- [ ] Verify tables created: Go to Table Editor → Check `f1_documents` exists

#### 2A.3 Get Supabase Credentials
- [ ] Go to Settings → API
- [ ] Copy Project URL
- [ ] Copy `anon` `public` key
- [ ] Copy `service_role` `secret` key (optional)
- [ ] Update `.env` file with these values
- [ ] Set `USE_SUPABASE=true`

### Option B: DataStax Astra DB Setup (Alternative)

#### 2B.1 Create Astra DB
- [ ] Go to [astra.datastax.com](https://astra.datastax.com)
- [ ] Create account/login
- [ ] Create Vector Database
- [ ] Choose region
- [ ] Wait for database to initialize

#### 2B.2 Get Astra Credentials
- [ ] Generate Application Token
- [ ] Copy Database ID
- [ ] Copy API Endpoint
- [ ] Update `.env` with Astra credentials
- [ ] Set `USE_SUPABASE=false`

## Step 3: Verify Setup

### 3.1 Test Configuration
- [ ] Run: `npm run check-setup`
- [ ] All AWS checks should pass
- [ ] Database connection should work
- [ ] Fix any errors before proceeding

### 3.2 Test System Components
- [ ] Run: `npm run test-system`
- [ ] Embedding generation should work
- [ ] Chat generation should work
- [ ] Database operations should work

## Step 4: Load F1 Data

### 4.1 Verify Data Files
- [ ] Check `formula1-datasets/` folder exists
- [ ] Required files present:
  - [ ] `Formula1_2024season_drivers.csv`
  - [ ] `Formula1_2024season_teams.csv`
  - [ ] `Formula1_2024season_raceResults.csv`
  - [ ] `Formula1_2023season_drivers.csv`
  - [ ] `Formula1_2023season_teams.csv`
  - [ ] `Formula1_2023season_raceResults.csv`

### 4.2 Ingest Data
- [ ] Run: `npm run ingest`
- [ ] Monitor output for errors
- [ ] Should process ~20 rows per file
- [ ] Should generate embeddings successfully
- [ ] Should insert documents into database

### 4.3 Verify Data Ingestion
- [ ] Check ingestion completed without major errors
- [ ] Run: `npm run check-setup` again
- [ ] Data ingestion status should show documents count > 0

## Step 5: Start the Application

### 5.1 Start Backend Services
- [ ] Verify all previous steps completed
- [ ] Backend should be working (embeddings + database)

### 5.2 Start Frontend
- [ ] Run: `cd ui && npm install` (if not done)
- [ ] Run: `cd ui && npm run dev`
- [ ] Open browser to `http://localhost:3000`
- [ ] UI should load without errors

### 5.3 Test End-to-End
- [ ] Ask a test question: "Who won the 2024 Formula 1 championship?"
- [ ] Should get AI response with F1 data
- [ ] Sources should be shown
- [ ] Response should be relevant

## Troubleshooting

### AWS Issues
- **"Security token invalid"**: Check AWS credentials in `.env`
- **"Access denied"**: Verify Bedrock permissions and region
- **"Model not found"**: Ensure models are enabled in Bedrock console

### Database Issues
- **Supabase "fetch failed"**: Check internet connection and URL
- **"Table doesn't exist"**: Run SQL setup commands
- **"Permission denied"**: Check API keys and RLS policies

### Data Issues
- **"No files found"**: Check `formula1-datasets/` folder
- **"Validation errors"**: Check CSV file format
- **"No embeddings"**: Verify AWS Bedrock is working

### UI Issues
- **"API errors"**: Check backend is running
- **"No response"**: Check chat API endpoint
- **"Network errors"**: Verify localhost:3000 is accessible

## Final Verification

Run this complete test sequence:

```bash
# 1. Health check
npm run check-setup

# 2. System test
npm run test-system

# 3. Query test
npm run answer

# 4. Team analysis
npm run team-analysis

# 5. Start UI
cd ui && npm run dev
```

All commands should complete successfully!

## Success Criteria

Your setup is complete when:

- [ ] `npm run check-setup` shows all green checkmarks
- [ ] `npm run test-system` passes all tests
- [ ] UI loads at `http://localhost:3000`
- [ ] Can ask F1 questions and get responses
- [ ] Sources are displayed with answers
- [ ] No major errors in console/logs

## Getting Help

If you encounter issues:

1. **Check this checklist** - ensure all steps completed
2. **Run diagnostics**: `npm run check-setup`
3. **Check logs**: Look for error messages in terminal
4. **Environment file**: Verify all credentials are correct
5. **Network**: Ensure internet connection for AWS/Supabase

## What's Next?

Once setup is complete:

- Explore asking different F1 questions
- Try team comparisons: "Compare Red Bull vs McLaren"
- Ask about specific drivers: "Tell me about Max Verstappen"
- Inquire about race results: "What were the results from Monaco?"
- Test season comparisons: "How did 2024 compare to 2023?"

Your F1 RAG AI system is now ready to answer Formula 1 questions!