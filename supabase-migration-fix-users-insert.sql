-- Migration: Fix users table INSERT policy for signup
-- Run this in your Supabase SQL editor

-- Add INSERT policy for users table to allow signup
CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);
