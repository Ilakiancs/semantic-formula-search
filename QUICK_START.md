# Quick Start Guide - F1 RAG AI Cloud

## 🚀 5-Minute Setup

Your Supabase connection is working! Just need to complete these final steps:

### Step 1: Set up Supabase Database (2 minutes)

1. **Open your Supabase project**:
   - Go to https://supabase.com/dashboard
   - Open your project (ukygqtisuqpyxfadqdkk)

2. **Run SQL Setup**:
   - Click **SQL Editor** in the left sidebar
   - Copy the entire contents of `setup.sql` file
   - Paste into the SQL Editor
   - Click **Run** (or press Ctrl/Cmd + Enter)
   - Should see success messages

### Step 2: Add AWS Credentials (1 minute)

1. **Get AWS credentials**:
   - Go to AWS Console > IAM > Users
   - Create user with Bedrock permissions if needed
   - Generate access keys

2. **Update .env file**:
   ```bash
   AWS_ACCESS_KEY_ID=AKIA...your_key_here
   AWS_SECRET_ACCESS_KEY=...your_secret_here
   ```

### Step 3: Verify Setup (30 seconds)

```bash
npm run check-setup
```

Should show all green checkmarks ✅

### Step 4: Load F1 Data (1 minute)

```bash
npm run ingest
```

Will process ~120 F1 records and generate embeddings.

### Step 5: Start the App (30 seconds)

```bash
cd ui && npm run dev
```

Open http://localhost:3000 and ask: "Who won the 2024 F1 championship?"

## 🎯 What's Working Now

✅ **Supabase**: Connected and configured  
✅ **Environment**: Properly set up  
✅ **Dependencies**: All installed  
✅ **Data Files**: F1 CSV files ready  

## ❌ What's Missing

- [ ] Database tables (run setup.sql)
- [ ] AWS credentials (update .env)

## 🔧 Troubleshooting

### "Could not find table f1_documents"
- Run the SQL setup in Supabase dashboard

### "AWS security token invalid"
- Add real AWS credentials to .env file

### "No F1 data found"
- Run `npm run ingest` after AWS setup

## 🆘 Need Help?

Run diagnostics:
```bash
npm run check-setup
npm run test-system
```

Your system is 90% ready! Just need those final SQL and AWS steps.