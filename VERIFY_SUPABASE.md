# Supabase Verification Guide

## Issue Detected

The Supabase URL `https://ukyqgtisqppyxfadqkk.supabase.co` appears to be unreachable. This guide will help you verify and fix your Supabase setup.

## Common Causes

1. **Project not fully initialized** - Supabase projects take 2-3 minutes to become active
2. **Incorrect URL** - The project URL might be wrong
3. **Project paused/deleted** - Free tier projects can be paused
4. **Network issues** - Local network or DNS problems

## Step-by-Step Verification

### Step 1: Check Supabase Project Status

1. Go to [supabase.com](https://supabase.com)
2. Sign in to your account
3. Check your project dashboard
4. Look for your project status:
   - **Active** (green) - Project is running
   - **Paused** (yellow) - Click "Restore" to resume
   - **Starting** (blue) - Wait for completion
   - **Error** (red) - Project has issues

### Step 2: Get Correct Project URL

1. In your Supabase dashboard, click on your project
2. Go to **Settings** → **API**
3. Copy the **Project URL** (should look like `https://xxxxx.supabase.co`)
4. Copy the **anon public** key
5. Compare with your `.env` file

### Step 3: Test URL Accessibility

Open your browser and try accessing your Supabase URL directly:
- Should show a page (not an error)
- If you get "This site can't be reached" - the project isn't ready

### Step 4: Update Environment File

If you found the correct URL, update your `.env` file:

```bash
# Replace with your actual Supabase URL and keys
SUPABASE_URL=https://your-actual-project-id.supabase.co
SUPABASE_ANON_KEY=your_actual_anon_key_here
```

## Quick Fixes

### Fix 1: Project Not Ready
If your project is still initializing:
- Wait 2-3 more minutes
- Refresh your Supabase dashboard
- Check if status changes to "Active"

### Fix 2: Project Paused
If your project is paused (common on free tier):
- Click **"Restore project"** in dashboard
- Wait for it to become active
- Free tier pauses after 1 week of inactivity

### Fix 3: Wrong Credentials
Double-check your Supabase settings:
1. Project URL format: `https://[project-id].supabase.co`
2. Anon key starts with `eyJ...`
3. No extra spaces or characters

### Fix 4: Create New Project
If your project is corrupted or missing:
1. Go to Supabase dashboard
2. Click **"New project"**
3. Choose organization and name
4. Select region (closest to you)
5. Wait for initialization
6. Get new URL and keys

## Test Connection

After fixing, test your connection:

```bash
# Test basic connectivity
curl -I https://your-project-id.supabase.co

# Should return HTTP headers, not "could not resolve host"
```

Or use our test script:
```bash
node test-supabase.js
```

## Database Setup (After Connection Works)

Once your Supabase project is accessible:

1. **Enable pgvector**:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

2. **Create tables** - Run all SQL from `SUPABASE_SETUP.md`

3. **Verify setup**:
   ```bash
   npm run check-setup
   ```

## Alternative Solutions

### Option 1: Use Different Supabase Account
- Create account with different email
- Start fresh project
- Update credentials in `.env`

### Option 2: Switch to Astra DB
If Supabase continues to have issues:

1. Update `.env`:
   ```bash
   USE_SUPABASE=false
   # Add Astra DB credentials instead
   ```

2. Follow Astra DB setup in main README

### Option 3: Local Development with Mock
For immediate testing without external database:
- Comment out database calls temporarily
- Focus on AWS Bedrock setup first
- Add database later when issues resolved

## Success Indicators

Your Supabase is working when:
- Project shows "Active" in dashboard
- URL is accessible in browser
- `curl` command returns HTTP headers
- `node test-supabase.js` connects successfully
- `npm run check-setup` shows database connection working

## Next Steps

1. **Fix Supabase connection** using steps above
2. **Complete database setup** with SQL commands
3. **Add AWS credentials** to `.env` file
4. **Run full verification**: `npm run check-setup`
5. **Ingest F1 data**: `npm run ingest`
6. **Start application**: `cd ui && npm run dev`

## Still Having Issues?

If problems persist:
1. Check Supabase status page for outages
2. Try creating project in different region
3. Verify internet connection and DNS
4. Consider using mobile hotspot to test network
5. Try from different computer/network

The most common issue is waiting for project initialization - give it a few more minutes and refresh your dashboard.