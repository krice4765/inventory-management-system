-- Fix user_profiles table schema cache issue
-- This script will drop and recreate the user_profiles table to force Supabase schema cache refresh

-- Drop existing policies first
DROP POLICY IF EXISTS "ユーザーは自分のプロファイルのみアクセス可能" ON user_profiles;
DROP POLICY IF EXISTS "管理者は全プロファイルアクセス可能" ON user_profiles;

-- Drop the table
DROP TABLE IF EXISTS user_profiles CASCADE;

-- Recreate user_profiles table
CREATE TABLE user_profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    company_name VARCHAR(255),
    department VARCHAR(255),
    position VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'user')),
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP WITH TIME ZONE,
    invited_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_user_profiles_email ON user_profiles(email);
CREATE INDEX idx_user_profiles_role ON user_profiles(role);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "ユーザーは自分のプロファイルのみアクセス可能" ON user_profiles
    FOR SELECT USING (id = auth.uid());

CREATE POLICY "管理者は全プロファイルアクセス可能" ON user_profiles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Insert admin users (use actual UUIDs from auth.users table)
-- Note: We'll need to get the actual UUIDs from auth.users after this script runs

SELECT 'user_profiles table recreated successfully' as status;