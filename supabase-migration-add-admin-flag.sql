-- Migration: Add admin flag to users table for demo functionality
-- Run this in your Supabase SQL editor

-- Add admin column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Add demo_mode column to users table for enabling/disabling demo bid generation
ALTER TABLE users ADD COLUMN IF NOT EXISTS demo_mode BOOLEAN DEFAULT FALSE;

-- Create index for efficient admin queries
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);
CREATE INDEX IF NOT EXISTS idx_users_demo_mode ON users(demo_mode);

-- Update the role check constraint to include 'admin'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('GC', 'sub', 'admin'));

-- Create a function to set a user as admin (for demo purposes)
CREATE OR REPLACE FUNCTION set_user_as_admin(user_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE users 
  SET is_admin = TRUE, role = 'admin'
  WHERE email = user_email;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to enable demo mode for a user
CREATE OR REPLACE FUNCTION enable_demo_mode(user_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE users 
  SET demo_mode = TRUE
  WHERE email = user_email AND is_admin = TRUE;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to disable demo mode for a user
CREATE OR REPLACE FUNCTION disable_demo_mode(user_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE users 
  SET demo_mode = FALSE
  WHERE email = user_email AND is_admin = TRUE;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
