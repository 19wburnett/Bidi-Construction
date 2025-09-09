-- Migration: Add pay-per-job functionality
-- Run this in your Supabase SQL editor

-- Add pay-per-job fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'subscription' CHECK (payment_type IN ('subscription', 'pay_per_job')),
ADD COLUMN IF NOT EXISTS pay_per_job_credits INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS pay_per_job_used INTEGER DEFAULT 0;

-- Add payment tracking to job_requests table
ALTER TABLE job_requests 
ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'subscription' CHECK (payment_type IN ('subscription', 'pay_per_job')),
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded'));

-- Create index for payment queries
CREATE INDEX IF NOT EXISTS idx_users_payment_type ON users(payment_type);
CREATE INDEX IF NOT EXISTS idx_job_requests_payment_status ON job_requests(payment_status);
CREATE INDEX IF NOT EXISTS idx_job_requests_payment_type ON job_requests(payment_type);
