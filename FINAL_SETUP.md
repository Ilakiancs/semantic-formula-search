# Final Setup Instructions - F1 RAG AI Cloud

## Current Status

**Supabase**: Connected (https://ukygqtisuqpyxfadqdkk.supabase.co)  
**AWS**: Credentials working, embeddings functional  
**Environment**: Properly configured  
**Code**: All dependencies installed  

## What You Need to Do (5 minutes)

### Step 1: Set Up Supabase Database (3 minutes)

1. **Open Supabase Dashboard**:
   - Go to [supabase.com/dashboard](https://supabase.com/dashboard)
   - Click on your project: `ukygqtisuqpyxfadqdkk`

2. **Run Database Setup**:
   - Click **SQL Editor** in the left sidebar
   - Open the file `setup.sql` in this project
   - Copy ALL the content (300+ lines)
   - Paste into the SQL Editor
   - Click **Run** button (or Ctrl/Cmd + Enter)
   - Wait for completion (should see success messages)

### Step 2: Verify Setup (1 minute)

```bash
npm run check-setup
```

You should see:
- All AWS checks pass
- Database connection works
- All systems green

### Step 3: Load F1 Data (1 minute)

```bash
npm run ingest
```

This will:
- Process ~120 F1 records
- Generate embeddings via AWS Bedrock
- Store in Supabase database

### Step 4: Start the Application (30 seconds)

```bash
cd ui && npm run dev
```

Open http://localhost:3000

## Test Your Setup

Ask these questions in the UI:
- "Who won the 2024 F1 championship?"
- "Compare Red Bull vs McLaren performance"
- "Tell me about Max Verstappen"

## If You Hit Issues

### "Could not find table f1_documents"
- **Fix**: Run the SQL setup script in Supabase dashboard
- The table needs to be created first

### "Could not find function get_f1_statistics"
- **Fix**: Complete SQL setup - the functions aren't created yet
- Copy ALL content from `setup.sql`

### AWS Model Issues
- Your embeddings are working
- Chat model updated to Claude Haiku
- Should work after database setup

## SQL Setup Checklist

When you run `setup.sql`, it will:
- [ ] Enable pgvector extension
- [ ] Create f1_documents table
- [ ] Create search functions
- [ ] Set up indexes for performance
- [ ] Configure security policies
- [ ] Show success confirmation

## Success Indicators

You'll know it's working when:
1. `npm run check-setup` shows all green checkmarks
2. `npm run ingest` completes without errors
3. UI loads at localhost:3000
4. You can ask F1 questions and get responses with sources

## Quick Commands Summary

```bash
# 1. Verify everything is ready
npm run check-setup

# 2. Load F1 data
npm run ingest

# 3. Test the system
npm run test-system

# 4. Start the UI
cd ui && npm run dev
```

## Still Need Help?

Your setup is 95% complete! The only missing piece is running that SQL script in Supabase.

**Supabase SQL Editor**: https://supabase.com/dashboard/project/ukygqtisuqpyxfadqdkk/sql

Copy the entire `setup.sql` file content and run it. That's it!

Once that's done, you'll have a fully functional F1 RAG AI system with:
- Vector similarity search
- AWS Bedrock embeddings and chat
- Comprehensive F1 data from 2022-2025
- Beautiful Next.js UI
- Type-safe operations with Zod validation

You're almost there!