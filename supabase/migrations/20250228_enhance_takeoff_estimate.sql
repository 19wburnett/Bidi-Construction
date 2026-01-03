-- Migration: Enhance takeoff with estimate data and review system
-- Adds review and missing information fields to plan_takeoff_analysis table

-- Add review and missing information JSONB columns to plan_takeoff_analysis
ALTER TABLE plan_takeoff_analysis 
ADD COLUMN IF NOT EXISTS review_results JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS missing_information JSONB DEFAULT '[]'::jsonb;

-- Create takeoff_reviews table to store review results (linked to plan_takeoff_analysis)
CREATE TABLE IF NOT EXISTS takeoff_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  takeoff_analysis_id UUID REFERENCES plan_takeoff_analysis(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
  reviewer_model TEXT NOT NULL, -- Which AI model performed the review
  review_type TEXT NOT NULL CHECK (review_type IN ('takeoff_review', 'reanalysis', 'validation')),
  findings JSONB NOT NULL DEFAULT '{}'::jsonb, -- Review findings (missing items, discrepancies, etc.)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes for faster queries
  CONSTRAINT takeoff_reviews_analysis_fk FOREIGN KEY (takeoff_analysis_id) REFERENCES plan_takeoff_analysis(id) ON DELETE CASCADE,
  CONSTRAINT takeoff_reviews_plan_fk FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_takeoff_reviews_analysis_id ON takeoff_reviews(takeoff_analysis_id);
CREATE INDEX IF NOT EXISTS idx_takeoff_reviews_plan_id ON takeoff_reviews(plan_id);
CREATE INDEX IF NOT EXISTS idx_takeoff_reviews_review_type ON takeoff_reviews(review_type);
CREATE INDEX IF NOT EXISTS idx_takeoff_reviews_created_at ON takeoff_reviews(created_at);

-- Create takeoff_missing_information table to store missing information reports (linked to plan_takeoff_analysis)
CREATE TABLE IF NOT EXISTS takeoff_missing_information (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  takeoff_analysis_id UUID REFERENCES plan_takeoff_analysis(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
  item_id TEXT, -- Item ID from the JSONB items array (not a foreign key since items are in JSONB)
  item_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('measurement', 'quantity', 'specification', 'detail', 'other')),
  missing_data TEXT NOT NULL, -- What specific information is missing
  why_needed TEXT NOT NULL, -- Why this information is needed for estimate
  where_to_find TEXT NOT NULL, -- Where to find it (sheet numbers, schedules, etc.)
  impact TEXT NOT NULL CHECK (impact IN ('critical', 'high', 'medium', 'low')), -- Impact on estimate accuracy
  suggested_action TEXT, -- What the user should do
  location TEXT, -- Where in the plans this item appears
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes for faster queries
  CONSTRAINT takeoff_missing_info_analysis_fk FOREIGN KEY (takeoff_analysis_id) REFERENCES plan_takeoff_analysis(id) ON DELETE CASCADE,
  CONSTRAINT takeoff_missing_info_plan_fk FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_takeoff_missing_info_analysis_id ON takeoff_missing_information(takeoff_analysis_id);
CREATE INDEX IF NOT EXISTS idx_takeoff_missing_info_plan_id ON takeoff_missing_information(plan_id);
CREATE INDEX IF NOT EXISTS idx_takeoff_missing_info_item_id ON takeoff_missing_information(item_id);
CREATE INDEX IF NOT EXISTS idx_takeoff_missing_info_category ON takeoff_missing_information(category);
CREATE INDEX IF NOT EXISTS idx_takeoff_missing_info_impact ON takeoff_missing_information(impact);
CREATE INDEX IF NOT EXISTS idx_takeoff_missing_info_resolved ON takeoff_missing_information(resolved);

-- Add comments
COMMENT ON COLUMN plan_takeoff_analysis.review_results IS 'JSONB field storing review results from multi-AI review stage';
COMMENT ON COLUMN plan_takeoff_analysis.missing_information IS 'JSONB array storing missing information reports - what cannot be determined from plans';
COMMENT ON TABLE takeoff_reviews IS 'Stores detailed results from each AI reviewer in the multi-AI review stage';
COMMENT ON TABLE takeoff_missing_information IS 'Stores missing information reports - what cannot be determined from plans and why it is needed';
