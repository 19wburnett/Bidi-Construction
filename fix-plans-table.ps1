# Fix Plans Table Job ID Error - PowerShell Version
# This script fixes the database error where the plans table is expecting
# a job_id field that doesn't exist.

Write-Host "🔧 Starting plans table fix..." -ForegroundColor Green

# You'll need to set these environment variables or replace with your actual values
$supabaseUrl = $env:NEXT_PUBLIC_SUPABASE_URL
$supabaseServiceKey = $env:SUPABASE_SERVICE_ROLE_KEY

if (-not $supabaseServiceKey) {
    Write-Host "❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required" -ForegroundColor Red
    Write-Host "Please set it in your .env.local file or run:" -ForegroundColor Yellow
    Write-Host "`$env:SUPABASE_SERVICE_ROLE_KEY='your_service_role_key'; .\fix-plans-table.ps1" -ForegroundColor Yellow
    exit 1
}

if (-not $supabaseUrl) {
    $supabaseUrl = "https://dkpucbqphkghrhiwtseb.supabase.co"
}

Write-Host "📝 Applying database fixes..." -ForegroundColor Blue

# The actual fix needs to be applied through the Supabase dashboard or CLI
# This PowerShell script provides instructions for manual application

Write-Host @"
🔧 MANUAL FIX REQUIRED

Since we can't execute SQL directly from PowerShell without additional setup,
please apply the following SQL commands in your Supabase dashboard:

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Run the following SQL commands:

-- Step 1: Drop problematic triggers
DROP TRIGGER IF EXISTS update_plans_updated_at ON plans;
DROP TRIGGER IF EXISTS update_plan_access_on_drawing ON plan_drawings;

-- Step 2: Recreate the update function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Step 3: Recreate the trigger
CREATE TRIGGER update_plans_updated_at 
  BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 4: Drop problematic constraints
ALTER TABLE plans DROP CONSTRAINT IF EXISTS plans_job_id_fkey;

-- Step 5: Ensure correct table structure
ALTER TABLE plans 
ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
ADD COLUMN IF NOT EXISTS user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS file_name TEXT NOT NULL,
ADD COLUMN IF NOT EXISTS file_path TEXT NOT NULL,
ADD COLUMN IF NOT EXISTS file_size BIGINT NOT NULL,
ADD COLUMN IF NOT EXISTS file_type TEXT NOT NULL,
ADD COLUMN IF NOT EXISTS num_pages INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS project_name TEXT,
ADD COLUMN IF NOT EXISTS project_location TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'ready', 'archived')),
ADD COLUMN IF NOT EXISTS processing_status JSONB DEFAULT '{"stage": "uploaded", "progress": 0}',
ADD COLUMN IF NOT EXISTS has_takeoff_analysis BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_quality_analysis BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ DEFAULT NOW();

-- Step 6: Recreate indexes
DROP INDEX IF EXISTS idx_plans_user_id;
DROP INDEX IF EXISTS idx_plans_status;
DROP INDEX IF EXISTS idx_plans_created_at;

CREATE INDEX IF NOT EXISTS idx_plans_user_id ON plans(user_id);
CREATE INDEX IF NOT EXISTS idx_plans_status ON plans(status);
CREATE INDEX IF NOT EXISTS idx_plans_created_at ON plans(created_at DESC);

✅ After running these commands, your plans table should work correctly!
"@ -ForegroundColor Cyan

Write-Host "`n🚀 Instructions provided! Apply the SQL commands above in your Supabase dashboard." -ForegroundColor Green
