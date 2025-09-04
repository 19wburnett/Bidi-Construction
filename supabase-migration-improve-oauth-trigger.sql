-- Migration: Improve OAuth user creation trigger
-- Run this in your Supabase SQL editor

-- Update the function to handle OAuth users better
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Insert user record with proper defaults
  INSERT INTO public.users (id, email, role, subscription_status)
  VALUES (
    new.id, 
    COALESCE(new.email, new.raw_user_meta_data->>'email'), 
    'GC', 
    'inactive'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(new.email, new.raw_user_meta_data->>'email'),
    updated_at = NOW();
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
