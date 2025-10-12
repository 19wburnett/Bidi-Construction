-- Create takeoffs table for AI-powered quantity takeoff data
CREATE TABLE IF NOT EXISTS takeoffs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES job_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_file_url TEXT NOT NULL,
  name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  
  -- Structured takeoff data in JSON format
  data JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- AI analysis metadata
  ai_analysis_status TEXT DEFAULT 'pending' CHECK (ai_analysis_status IN ('pending', 'processing', 'completed', 'failed')),
  ai_analysis_result JSONB,
  ai_confidence_score DECIMAL(3,2),
  
  -- Collaboration metadata
  last_edited_by UUID REFERENCES users(id),
  is_locked BOOLEAN DEFAULT false,
  locked_by UUID REFERENCES users(id),
  locked_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create takeoff_items table for individual line items
CREATE TABLE IF NOT EXISTS takeoff_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  takeoff_id UUID NOT NULL REFERENCES takeoffs(id) ON DELETE CASCADE,
  
  -- Item identification
  item_type TEXT NOT NULL, -- e.g. 'wall', 'door', 'window', 'concrete', 'electrical_outlet'
  category TEXT NOT NULL, -- e.g. 'structural', 'electrical', 'plumbing', 'finishes'
  description TEXT NOT NULL,
  
  -- Quantities and measurements
  quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL, -- e.g. 'sq ft', 'linear ft', 'units', 'cu yd'
  
  -- Pricing
  unit_cost DECIMAL(10,2) DEFAULT 0,
  total_cost DECIMAL(10,2) GENERATED ALWAYS AS (quantity * COALESCE(unit_cost, 0)) STORED,
  
  -- Location and source
  location_reference TEXT, -- e.g. "Floor 1, Room A", "Sheet 3, Grid B-4"
  detected_by TEXT DEFAULT 'manual' CHECK (detected_by IN ('ai', 'manual', 'imported')),
  confidence_score DECIMAL(3,2),
  
  -- AI detection metadata
  detection_coordinates JSONB, -- stores bounding box or polygon coordinates
  plan_page_number INTEGER,
  
  -- Additional metadata
  notes TEXT,
  tags TEXT[],
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

-- Create takeoff_versions table for version control
CREATE TABLE IF NOT EXISTS takeoff_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  takeoff_id UUID NOT NULL REFERENCES takeoffs(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  name TEXT,
  description TEXT,
  
  -- Snapshot of data at this version
  data_snapshot JSONB NOT NULL,
  items_snapshot JSONB NOT NULL,
  
  -- Metadata
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(takeoff_id, version_number)
);

-- Create takeoff_comments table for collaboration
CREATE TABLE IF NOT EXISTS takeoff_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  takeoff_id UUID NOT NULL REFERENCES takeoffs(id) ON DELETE CASCADE,
  takeoff_item_id UUID REFERENCES takeoff_items(id) ON DELETE CASCADE,
  
  content TEXT NOT NULL,
  comment_type TEXT DEFAULT 'general' CHECK (comment_type IN ('general', 'question', 'suggestion', 'issue')),
  
  -- For threaded replies
  parent_comment_id UUID REFERENCES takeoff_comments(id) ON DELETE CASCADE,
  
  -- Metadata
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_resolved BOOLEAN DEFAULT false
);

-- Create takeoff_presence table for real-time collaboration awareness
CREATE TABLE IF NOT EXISTS takeoff_presence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  takeoff_id UUID NOT NULL REFERENCES takeoffs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Presence data
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  current_view TEXT, -- e.g. 'table', 'pdf', 'chat'
  cursor_position JSONB,
  
  UNIQUE(takeoff_id, user_id)
);

-- Create cost_templates table for pricing templates
CREATE TABLE IF NOT EXISTS cost_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  is_global BOOLEAN DEFAULT false, -- true for system-wide templates
  
  name TEXT NOT NULL,
  trade_category TEXT NOT NULL,
  description TEXT,
  
  -- Template data: array of {item_type, unit, unit_cost, notes}
  template_data JSONB NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create AI chat history table
CREATE TABLE IF NOT EXISTS takeoff_ai_chat (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  takeoff_id UUID NOT NULL REFERENCES takeoffs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  
  -- Context references
  references_items UUID[], -- array of takeoff_item IDs
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_takeoffs_project_id ON takeoffs(project_id);
CREATE INDEX idx_takeoffs_user_id ON takeoffs(user_id);
CREATE INDEX idx_takeoffs_status ON takeoffs(status);
CREATE INDEX idx_takeoff_items_takeoff_id ON takeoff_items(takeoff_id);
CREATE INDEX idx_takeoff_items_category ON takeoff_items(category);
CREATE INDEX idx_takeoff_items_item_type ON takeoff_items(item_type);
CREATE INDEX idx_takeoff_versions_takeoff_id ON takeoff_versions(takeoff_id);
CREATE INDEX idx_takeoff_comments_takeoff_id ON takeoff_comments(takeoff_id);
CREATE INDEX idx_takeoff_comments_item_id ON takeoff_comments(takeoff_item_id);
CREATE INDEX idx_takeoff_presence_takeoff_id ON takeoff_presence(takeoff_id);
CREATE INDEX idx_takeoff_ai_chat_takeoff_id ON takeoff_ai_chat(takeoff_id);
CREATE INDEX idx_cost_templates_trade ON cost_templates(trade_category);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_takeoffs_updated_at BEFORE UPDATE ON takeoffs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_takeoff_items_updated_at BEFORE UPDATE ON takeoff_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_takeoff_comments_updated_at BEFORE UPDATE ON takeoff_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cost_templates_updated_at BEFORE UPDATE ON cost_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to automatically create version snapshots
CREATE OR REPLACE FUNCTION create_takeoff_version_snapshot()
RETURNS TRIGGER AS $$
DECLARE
  v_items JSONB;
BEGIN
  -- Get all items for this takeoff
  SELECT COALESCE(json_agg(row_to_json(ti.*)), '[]'::json)::jsonb
  INTO v_items
  FROM takeoff_items ti
  WHERE ti.takeoff_id = NEW.id;
  
  -- Insert version snapshot if version number changed
  IF (TG_OP = 'INSERT' OR OLD.version IS DISTINCT FROM NEW.version) THEN
    INSERT INTO takeoff_versions (
      takeoff_id,
      version_number,
      name,
      description,
      data_snapshot,
      items_snapshot,
      created_by
    ) VALUES (
      NEW.id,
      NEW.version,
      'Version ' || NEW.version,
      'Auto-saved version',
      NEW.data,
      v_items,
      COALESCE(NEW.last_edited_by, NEW.user_id)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for version snapshots
CREATE TRIGGER create_version_on_takeoff_update
  AFTER INSERT OR UPDATE OF version ON takeoffs
  FOR EACH ROW
  EXECUTE FUNCTION create_takeoff_version_snapshot();

-- Enable Row Level Security
ALTER TABLE takeoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE takeoff_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE takeoff_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE takeoff_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE takeoff_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE takeoff_ai_chat ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for takeoffs
CREATE POLICY "Users can view takeoffs for their projects"
  ON takeoffs FOR SELECT
  USING (
    user_id = auth.uid() 
    OR project_id IN (
      SELECT id FROM job_requests WHERE gc_id = auth.uid()
    )
  );

CREATE POLICY "Users can create takeoffs for their projects"
  ON takeoffs FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own takeoffs"
  ON takeoffs FOR UPDATE
  USING (user_id = auth.uid() OR last_edited_by = auth.uid());

CREATE POLICY "Users can delete their own takeoffs"
  ON takeoffs FOR DELETE
  USING (user_id = auth.uid());

-- Create RLS policies for takeoff_items
CREATE POLICY "Users can view items for accessible takeoffs"
  ON takeoff_items FOR SELECT
  USING (
    takeoff_id IN (
      SELECT id FROM takeoffs WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create items for their takeoffs"
  ON takeoff_items FOR INSERT
  WITH CHECK (
    takeoff_id IN (
      SELECT id FROM takeoffs WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update items for their takeoffs"
  ON takeoff_items FOR UPDATE
  USING (
    takeoff_id IN (
      SELECT id FROM takeoffs WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete items for their takeoffs"
  ON takeoff_items FOR DELETE
  USING (
    takeoff_id IN (
      SELECT id FROM takeoffs WHERE user_id = auth.uid()
    )
  );

-- Create RLS policies for other tables (similar pattern)
CREATE POLICY "Users can view versions for their takeoffs"
  ON takeoff_versions FOR SELECT
  USING (
    takeoff_id IN (
      SELECT id FROM takeoffs WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view comments for their takeoffs"
  ON takeoff_comments FOR SELECT
  USING (
    takeoff_id IN (
      SELECT id FROM takeoffs WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create comments for accessible takeoffs"
  ON takeoff_comments FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND takeoff_id IN (
      SELECT id FROM takeoffs WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own comments"
  ON takeoff_comments FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Users can view presence for their takeoffs"
  ON takeoff_presence FOR SELECT
  USING (
    takeoff_id IN (
      SELECT id FROM takeoffs WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own presence"
  ON takeoff_presence FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Users can view global cost templates or their own"
  ON cost_templates FOR SELECT
  USING (is_global = true OR user_id = auth.uid());

CREATE POLICY "Users can create their own cost templates"
  ON cost_templates FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own cost templates"
  ON cost_templates FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can view AI chat for their takeoffs"
  ON takeoff_ai_chat FOR SELECT
  USING (
    takeoff_id IN (
      SELECT id FROM takeoffs WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create AI chat messages"
  ON takeoff_ai_chat FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Insert some default cost templates
INSERT INTO cost_templates (is_global, name, trade_category, description, template_data) VALUES
(true, 'Standard Framing Costs', 'Framing', 'Standard residential framing cost estimates', 
  '[
    {"item_type": "wall_framing", "unit": "linear ft", "unit_cost": 8.50, "notes": "2x4 studs, 16in OC"},
    {"item_type": "ceiling_framing", "unit": "sq ft", "unit_cost": 2.25, "notes": "2x6 ceiling joists"},
    {"item_type": "floor_framing", "unit": "sq ft", "unit_cost": 3.50, "notes": "2x10 floor joists"}
  ]'::jsonb),
(true, 'Standard Electrical Costs', 'Electrical', 'Standard electrical installation costs', 
  '[
    {"item_type": "outlet", "unit": "units", "unit_cost": 75.00, "notes": "Standard 120V outlet"},
    {"item_type": "light_switch", "unit": "units", "unit_cost": 65.00, "notes": "Single pole switch"},
    {"item_type": "light_fixture", "unit": "units", "unit_cost": 150.00, "notes": "Standard ceiling fixture"},
    {"item_type": "panel_upgrade", "unit": "units", "unit_cost": 1500.00, "notes": "200A service panel"}
  ]'::jsonb),
(true, 'Standard Drywall Costs', 'Drywall', 'Standard drywall installation and finishing', 
  '[
    {"item_type": "drywall_installation", "unit": "sq ft", "unit_cost": 1.75, "notes": "1/2in drywall, hung and taped"},
    {"item_type": "drywall_finishing", "unit": "sq ft", "unit_cost": 0.50, "notes": "Level 4 finish"},
    {"item_type": "texture", "unit": "sq ft", "unit_cost": 0.35, "notes": "Knockdown texture"}
  ]'::jsonb),
(true, 'Standard Concrete Costs', 'Concrete', 'Standard concrete and foundation costs', 
  '[
    {"item_type": "concrete_slab", "unit": "sq ft", "unit_cost": 6.50, "notes": "4in slab with rebar"},
    {"item_type": "concrete_footing", "unit": "linear ft", "unit_cost": 12.00, "notes": "18x8 footing"},
    {"item_type": "concrete_wall", "unit": "sq ft", "unit_cost": 15.00, "notes": "8in foundation wall"}
  ]'::jsonb),
(true, 'Standard Plumbing Costs', 'Plumbing', 'Standard plumbing fixture and rough-in costs', 
  '[
    {"item_type": "water_line", "unit": "linear ft", "unit_cost": 8.00, "notes": "3/4in copper"},
    {"item_type": "drain_line", "unit": "linear ft", "unit_cost": 12.00, "notes": "3in PVC"},
    {"item_type": "toilet_install", "unit": "units", "unit_cost": 350.00, "notes": "Standard toilet with wax ring"},
    {"item_type": "sink_install", "unit": "units", "unit_cost": 275.00, "notes": "Vanity sink with faucet"}
  ]'::jsonb);

COMMENT ON TABLE takeoffs IS 'Stores AI-powered quantity takeoff data for construction plans';
COMMENT ON TABLE takeoff_items IS 'Individual line items detected or manually entered for takeoffs';
COMMENT ON TABLE takeoff_versions IS 'Version history for takeoffs allowing rollback and comparison';
COMMENT ON TABLE takeoff_comments IS 'Collaborative comments and discussions on takeoff items';
COMMENT ON TABLE takeoff_presence IS 'Real-time presence tracking for collaborative editing';
COMMENT ON TABLE cost_templates IS 'Reusable cost templates for common construction items';
COMMENT ON TABLE takeoff_ai_chat IS 'AI assistant chat history for plan review and questions';

