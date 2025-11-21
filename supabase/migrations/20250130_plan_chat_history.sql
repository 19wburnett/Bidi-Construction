-- Migration: Plan Chat History (V3)
-- Stores conversation history with summaries for Plan Chat V3 memory system

CREATE TABLE IF NOT EXISTS plan_chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  
  -- Message content
  user_message TEXT NOT NULL,
  assistant_message TEXT NOT NULL,
  
  -- Memory compression
  summary TEXT, -- Compressed summary of this turn (optional, for older conversations)
  
  -- Metadata
  metadata JSONB DEFAULT '{}', -- Can store classification, retrieval info, etc.
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_plan_chat_history_plan_user ON plan_chat_history(plan_id, user_id);
CREATE INDEX IF NOT EXISTS idx_plan_chat_history_created_at ON plan_chat_history(plan_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_plan_chat_history_job_id ON plan_chat_history(job_id) WHERE job_id IS NOT NULL;

-- RLS Policies
ALTER TABLE plan_chat_history ENABLE ROW LEVEL SECURITY;

-- Users can view their own chat history
CREATE POLICY "Users can view their own plan chat history"
  ON plan_chat_history
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own chat history
CREATE POLICY "Users can insert their own plan chat history"
  ON plan_chat_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own chat history (for cleanup)
CREATE POLICY "Users can delete their own plan chat history"
  ON plan_chat_history
  FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE plan_chat_history IS 'Stores plan chat conversation history with summaries for V3 memory system';
COMMENT ON COLUMN plan_chat_history.summary IS 'Compressed summary of this conversation turn (for memory compression)';
COMMENT ON COLUMN plan_chat_history.metadata IS 'Optional metadata about the conversation turn (e.g., classification, retrieval info)';

