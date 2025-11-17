-- Migration: Plan Chat Messages
-- Store plan chat conversations in the database for analytics and persistence

CREATE TABLE IF NOT EXISTS plan_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  
  -- Message content
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  
  -- Metadata for analytics
  message_metadata JSONB DEFAULT '{}', -- Can store things like which takeoff items were referenced, etc.
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_plan_chat_messages_plan_user ON plan_chat_messages(plan_id, user_id);
CREATE INDEX IF NOT EXISTS idx_plan_chat_messages_created_at ON plan_chat_messages(plan_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_plan_chat_messages_job_id ON plan_chat_messages(job_id) WHERE job_id IS NOT NULL;

-- RLS Policies
ALTER TABLE plan_chat_messages ENABLE ROW LEVEL SECURITY;

-- Users can view their own messages
CREATE POLICY "Users can view their own plan chat messages"
  ON plan_chat_messages
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own messages
CREATE POLICY "Users can insert their own plan chat messages"
  ON plan_chat_messages
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own messages (for cleanup)
CREATE POLICY "Users can delete their own plan chat messages"
  ON plan_chat_messages
  FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE plan_chat_messages IS 'Stores plan chat conversation history for analytics and persistence';
COMMENT ON COLUMN plan_chat_messages.message_metadata IS 'Optional metadata about the message (e.g., referenced takeoff items, cost breakdowns shown, etc.)';

