-- Fix RLS policy for user_applications table to allow public INSERT
-- This allows anonymous users to submit applications while maintaining security

-- Drop existing restrictive policy if it exists
DROP POLICY IF EXISTS "Users can only access their own applications" ON user_applications;

-- Create policy allowing anyone to INSERT (for public application form)
CREATE POLICY "Allow public application submission"
ON user_applications FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Create policy allowing users to view only their own applications
CREATE POLICY "Users can view their own applications"
ON user_applications FOR SELECT
TO authenticated
USING (email = auth.jwt() ->> 'email');

-- Create policy allowing admins to view all applications
CREATE POLICY "Admins can view all applications"
ON user_applications FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
);

-- Create policy allowing admins to update application status
CREATE POLICY "Admins can update application status"
ON user_applications FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
);

-- Ensure RLS is enabled
ALTER TABLE user_applications ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT INSERT ON user_applications TO anon;
GRANT SELECT, UPDATE ON user_applications TO authenticated;