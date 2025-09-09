-- Migration: Fix payment_type check constraint to include 'credits'
-- Run this in your Supabase SQL editor

-- Update the check constraint on job_requests table to include 'credits'
ALTER TABLE job_requests 
DROP CONSTRAINT IF EXISTS job_requests_payment_type_check;

ALTER TABLE job_requests 
ADD CONSTRAINT job_requests_payment_type_check 
CHECK (payment_type IN ('subscription', 'pay_per_job', 'credits'));

-- Update the check constraint on users table to include 'credits' (if it exists)
ALTER TABLE users 
DROP CONSTRAINT IF EXISTS users_payment_type_check;

ALTER TABLE users 
ADD CONSTRAINT users_payment_type_check 
CHECK (payment_type IN ('subscription', 'pay_per_job', 'credits'));
