-- Migration: Plans System with Drawing Tools and Analysis
-- Create tables for the new plans-first workflow

-- Drop existing takeoffs tables if they exist
DROP TABLE IF EXISTS takeoff_ai_chat CASCADE;
DROP TABLE IF EXISTS takeoff_comments CASCADE;
DROP TABLE IF EXISTS takeoff_presence CASCADE;
DROP TABLE IF EXISTS takeoff_items CASCADE;
DROP TABLE IF EXISTS takeoffs CASCADE;

-- ============================================================================
-- PLANS TABLE
-- Stores uploaded plan files (PDFs, images, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- File information
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL, -- Storage path
  file_size BIGINT NOT NULL,
  file_type TEXT NOT NULL, -- e.g., 'application/pdf', 'image/png'
  num_pages INTEGER DEFAULT 1,
  
  -- Plan metadata
  title TEXT,
  description TEXT,
  project_name TEXT,
  project_location TEXT,
  
  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'ready', 'archived')),
  processing_status JSONB DEFAULT '{"stage": "uploaded", "progress": 0}',
  
  -- Analysis flags
  has_takeoff_analysis BOOLEAN DEFAULT FALSE,
  has_quality_analysis BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_plans_user_id ON plans(user_id);
CREATE INDEX idx_plans_status ON plans(status);
CREATE INDEX idx_plans_created_at ON plans(created_at DESC);

-- ============================================================================
-- PLAN_DRAWINGS TABLE
-- Stores Figma-like drawing annotations (lines, shapes, measurements)
-- ============================================================================
CREATE TABLE IF NOT EXISTS plan_drawings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Page reference
  page_number INTEGER NOT NULL DEFAULT 1,
  
  -- Drawing data
  drawing_type TEXT NOT NULL CHECK (drawing_type IN ('line', 'rectangle', 'circle', 'polygon', 'measurement', 'annotation', 'area')),
  geometry JSONB NOT NULL, -- Stores coordinates, dimensions, etc.
  
  -- Styling
  style JSONB DEFAULT '{"color": "#3b82f6", "strokeWidth": 2, "opacity": 1}',
  
  -- Measurement data (for scale measurements)
  measurement_data JSONB, -- { "length": 120, "unit": "ft", "scale": "1/4\" = 1'" }
  
  -- Label/annotation
  label TEXT,
  notes TEXT,
  
  -- Layer management
  layer_name TEXT DEFAULT 'default',
  is_visible BOOLEAN DEFAULT TRUE,
  is_locked BOOLEAN DEFAULT FALSE,
  z_index INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_plan_drawings_plan_id ON plan_drawings(plan_id);
CREATE INDEX idx_plan_drawings_page ON plan_drawings(plan_id, page_number);
CREATE INDEX idx_plan_drawings_layer ON plan_drawings(plan_id, layer_name);

-- ============================================================================
-- PLAN_TAKEOFF_ANALYSIS TABLE
-- Stores AI-generated takeoff analysis results
-- ============================================================================
CREATE TABLE IF NOT EXISTS plan_takeoff_analysis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Analysis data
  items JSONB NOT NULL DEFAULT '[]', -- Array of takeoff items with quantities, costs
  summary JSONB, -- Overall summary stats
  
  -- AI metadata
  ai_model TEXT,
  confidence_scores JSONB,
  processing_time_ms INTEGER,
  
  -- Manual edits
  edited_items JSONB, -- User modifications to AI results
  is_finalized BOOLEAN DEFAULT FALSE,
  
  -- Version control
  version INTEGER DEFAULT 1,
  parent_version_id UUID REFERENCES plan_takeoff_analysis(id),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_takeoff_analysis_plan_id ON plan_takeoff_analysis(plan_id);
CREATE INDEX idx_takeoff_analysis_version ON plan_takeoff_analysis(plan_id, version DESC);

-- ============================================================================
-- PLAN_QUALITY_ANALYSIS TABLE
-- Stores AI analysis of plan quality/completeness
-- ============================================================================
CREATE TABLE IF NOT EXISTS plan_quality_analysis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Analysis results
  overall_score NUMERIC(3,2) CHECK (overall_score >= 0 AND overall_score <= 1),
  issues JSONB NOT NULL DEFAULT '[]', -- Array of detected issues
  missing_details JSONB DEFAULT '[]',
  recommendations JSONB DEFAULT '[]',
  
  -- Categorized findings
  findings_by_category JSONB, -- { "structural": [...], "electrical": [...], etc. }
  findings_by_severity JSONB, -- { "critical": [...], "warning": [...], "info": [...] }
  
  -- Page-specific findings
  page_findings JSONB, -- { "1": [...], "2": [...], etc. }
  
  -- AI metadata
  ai_model TEXT,
  processing_time_ms INTEGER,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_quality_analysis_plan_id ON plan_quality_analysis(plan_id);
CREATE INDEX idx_quality_analysis_score ON plan_quality_analysis(overall_score);

-- ============================================================================
-- PLAN_SCALE_SETTINGS TABLE
-- Stores scale calibration for accurate measurements
-- ============================================================================
CREATE TABLE IF NOT EXISTS plan_scale_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL DEFAULT 1,
  
  -- Scale calibration
  scale_ratio TEXT, -- e.g., "1/4\" = 1'"
  pixels_per_unit NUMERIC(10,4), -- Calculated conversion
  unit TEXT DEFAULT 'ft' CHECK (unit IN ('ft', 'in', 'm', 'cm', 'mm')),
  
  -- Calibration reference points
  calibration_line JSONB, -- { "start": {x, y}, "end": {x, y}, "known_length": 10, "unit": "ft" }
  
  -- Metadata
  is_auto_detected BOOLEAN DEFAULT FALSE,
  confidence_score NUMERIC(3,2),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(plan_id, page_number)
);

-- Indexes
CREATE INDEX idx_scale_settings_plan ON plan_scale_settings(plan_id);

-- ============================================================================
-- PLAN_COMMENTS TABLE
-- Comments and collaboration on specific plan locations
-- ============================================================================
CREATE TABLE IF NOT EXISTS plan_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Comment location
  page_number INTEGER NOT NULL,
  position JSONB NOT NULL, -- { "x": 50, "y": 30 } (percentage-based)
  
  -- Comment content
  content TEXT NOT NULL,
  comment_type TEXT DEFAULT 'general' CHECK (comment_type IN ('general', 'question', 'issue', 'resolved')),
  
  -- Thread support
  parent_comment_id UUID REFERENCES plan_comments(id) ON DELETE CASCADE,
  
  -- Status
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_plan_comments_plan ON plan_comments(plan_id);
CREATE INDEX idx_plan_comments_page ON plan_comments(plan_id, page_number);
CREATE INDEX idx_plan_comments_thread ON plan_comments(parent_comment_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_drawings ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_takeoff_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_quality_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_scale_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_comments ENABLE ROW LEVEL SECURITY;

-- Plans policies
CREATE POLICY "Users can view their own plans"
  ON plans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own plans"
  ON plans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own plans"
  ON plans FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own plans"
  ON plans FOR DELETE
  USING (auth.uid() = user_id);

-- Plan drawings policies
CREATE POLICY "Users can view drawings on their plans"
  ON plan_drawings FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM plans WHERE plans.id = plan_drawings.plan_id AND plans.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert drawings on their plans"
  ON plan_drawings FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM plans WHERE plans.id = plan_drawings.plan_id AND plans.user_id = auth.uid()
  ));

CREATE POLICY "Users can update their own drawings"
  ON plan_drawings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own drawings"
  ON plan_drawings FOR DELETE
  USING (auth.uid() = user_id);

-- Takeoff analysis policies
CREATE POLICY "Users can view takeoff analysis for their plans"
  ON plan_takeoff_analysis FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert takeoff analysis for their plans"
  ON plan_takeoff_analysis FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own takeoff analysis"
  ON plan_takeoff_analysis FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own takeoff analysis"
  ON plan_takeoff_analysis FOR DELETE
  USING (auth.uid() = user_id);

-- Quality analysis policies
CREATE POLICY "Users can view quality analysis for their plans"
  ON plan_quality_analysis FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert quality analysis for their plans"
  ON plan_quality_analysis FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own quality analysis"
  ON plan_quality_analysis FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own quality analysis"
  ON plan_quality_analysis FOR DELETE
  USING (auth.uid() = user_id);

-- Scale settings policies
CREATE POLICY "Users can view scale settings for their plans"
  ON plan_scale_settings FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM plans WHERE plans.id = plan_scale_settings.plan_id AND plans.user_id = auth.uid()
  ));

CREATE POLICY "Users can manage scale settings for their plans"
  ON plan_scale_settings FOR ALL
  USING (EXISTS (
    SELECT 1 FROM plans WHERE plans.id = plan_scale_settings.plan_id AND plans.user_id = auth.uid()
  ));

-- Comments policies
CREATE POLICY "Users can view comments on their plans"
  ON plan_comments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM plans WHERE plans.id = plan_comments.plan_id AND plans.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert comments on their plans"
  ON plan_comments FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM plans WHERE plans.id = plan_comments.plan_id AND plans.user_id = auth.uid()
  ));

CREATE POLICY "Users can update their own comments"
  ON plan_comments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
  ON plan_comments FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plan_drawings_updated_at BEFORE UPDATE ON plan_drawings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_takeoff_analysis_updated_at BEFORE UPDATE ON plan_takeoff_analysis
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quality_analysis_updated_at BEFORE UPDATE ON plan_quality_analysis
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scale_settings_updated_at BEFORE UPDATE ON plan_scale_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plan_comments_updated_at BEFORE UPDATE ON plan_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update plan's last_accessed_at when drawings are added
CREATE OR REPLACE FUNCTION update_plan_last_accessed()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE plans SET last_accessed_at = NOW() WHERE id = NEW.plan_id;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_plan_access_on_drawing AFTER INSERT ON plan_drawings
  FOR EACH ROW EXECUTE FUNCTION update_plan_last_accessed();

-- ============================================================================
-- STORAGE BUCKET
-- ============================================================================

-- Create storage bucket for plan files (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('plans', 'plans', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for plans bucket
CREATE POLICY "Users can upload their own plan files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'plans' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own plan files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'plans' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own plan files"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'plans' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own plan files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'plans' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

