-- Migration: Add credit system
-- Run this in your Supabase SQL editor

-- Add credit fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_credits_purchased INTEGER DEFAULT 0;

-- Create credit_purchases table to track credit purchases
CREATE TABLE IF NOT EXISTS credit_purchases (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  credits_purchased INTEGER NOT NULL,
  amount_paid DECIMAL(10,2) NOT NULL,
  stripe_payment_intent_id TEXT,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add credit tracking to job_requests table
ALTER TABLE job_requests 
ADD COLUMN IF NOT EXISTS credits_used INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS credit_purchase_id UUID REFERENCES credit_purchases(id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_credits ON users(credits);
CREATE INDEX IF NOT EXISTS idx_credit_purchases_user_id ON credit_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_purchases_payment_status ON credit_purchases(payment_status);
CREATE INDEX IF NOT EXISTS idx_job_requests_credit_purchase_id ON job_requests(credit_purchase_id);

-- Enable RLS on credit_purchases table
ALTER TABLE credit_purchases ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for credit_purchases
CREATE POLICY "Users can view own credit purchases" ON credit_purchases
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own credit purchases" ON credit_purchases
  FOR INSERT WITH CHECK (auth.uid() = user_id);

