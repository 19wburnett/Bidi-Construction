-- Fix RLS Policies for estimate_signups table
-- Run this in Supabase SQL Editor if you're getting RLS policy violations

-- First, drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Anyone can sign up for estimates" ON estimate_signups;
DROP POLICY IF EXISTS "Admins can view all signups" ON estimate_signups;
DROP POLICY IF EXISTS "Allow duplicate email check" ON estimate_signups;
DROP POLICY IF EXISTS "Admins can delete signups" ON estimate_signups;

-- Create INSERT policy - Allow anyone to insert (for public signup form)
CREATE POLICY "Anyone can sign up for estimates" ON estimate_signups
  FOR INSERT 
  WITH CHECK (true);

-- Create SELECT policy - Allow checking for duplicates (required for API route)
CREATE POLICY "Allow duplicate email check" ON estimate_signups
  FOR SELECT 
  USING (true);

-- Create DELETE policy - Only admins can delete signups
CREATE POLICY "Admins can delete signups" ON estimate_signups
  FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.is_admin = true OR users.role = 'admin')
    )
  );

-- Verify policies are created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'estimate_signups';

