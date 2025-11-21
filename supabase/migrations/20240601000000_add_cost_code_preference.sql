-- Add preferred_cost_code_standard column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_cost_code_standard text DEFAULT 'csi-16';

-- Add comment to explain the column
COMMENT ON COLUMN users.preferred_cost_code_standard IS 'The preferred cost code standard for the user (amex, csi-16, csi-50, nahb)';

