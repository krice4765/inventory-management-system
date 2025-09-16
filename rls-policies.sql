-- RLS Policies for user_applications table
-- This script sets up Row Level Security policies for the user_applications table

-- Ensure RLS is enabled
ALTER TABLE user_applications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow anonymous insert applications" ON user_applications;
DROP POLICY IF EXISTS "Allow authenticated users to read own applications" ON user_applications;
DROP POLICY IF EXISTS "Allow admin full access" ON user_applications;

-- Create new RLS policies
CREATE POLICY "Allow anonymous insert applications"
ON user_applications FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read own applications"
ON user_applications FOR SELECT
TO authenticated
USING (auth.email() = email);

CREATE POLICY "Allow admin full access"
ON user_applications FOR ALL
TO authenticated
USING (
  auth.email() IN (
    'dev@inventory.test',
    'Krice4765104@gmail.com',
    'prod@inventory.test'
  )
);