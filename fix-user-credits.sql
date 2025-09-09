-- Fix user credits and payment type
-- Replace 'YOUR_USER_ID' with your actual user ID from the debug info

UPDATE users 
SET 
  payment_type = 'credits',
  credits = 1,
  total_credits_purchased = 1
WHERE id = 'YOUR_USER_ID';

-- To find your user ID, you can run this query first:
-- SELECT id, email, credits, payment_type FROM users WHERE email = 'your-email@example.com';
