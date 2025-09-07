-- Temporarily disable Row Level Security to allow data insertion
-- Run this in Supabase SQL Editor to fix the insertion issue

-- Disable RLS on the f1_documents table
ALTER TABLE f1_documents DISABLE ROW LEVEL SECURITY;

-- Drop existing policies (they can be recreated later if needed)
DROP POLICY IF EXISTS "authenticated_users_all_access" ON f1_documents;
DROP POLICY IF EXISTS "anonymous_users_read_access" ON f1_documents;
DROP POLICY IF EXISTS "service_role_all_access" ON f1_documents;

-- Verify RLS is disabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'f1_documents';

-- This should show rowsecurity = false

-- Note: You can re-enable RLS later after data insertion with:
-- ALTER TABLE f1_documents ENABLE ROW LEVEL SECURITY;
