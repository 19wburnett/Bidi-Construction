-- Migration: Add Chat Sessions Support
-- Enables multiple chat sessions per plan/job, organized by chat_id

-- ============================================================================
-- PLAN_CHAT_SESSIONS TABLE
-- Stores chat session metadata (one chat session = one conversation thread)
-- ============================================================================
CREATE TABLE IF NOT EXISTS plan_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Chat metadata
  title TEXT, -- Auto-generated or user-provided title (e.g., "Takeoff Discussion", "Scope Review")
  description TEXT, -- Optional description
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_plan_chat_sessions_job_plan ON plan_chat_sessions(job_id, plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_chat_sessions_user ON plan_chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_plan_chat_sessions_updated ON plan_chat_sessions(job_id, plan_id, updated_at DESC);

-- RLS Policies
ALTER TABLE plan_chat_sessions ENABLE ROW LEVEL SECURITY;

-- Users can view their own chat sessions
CREATE POLICY "Users can view their own chat sessions"
  ON plan_chat_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own chat sessions
CREATE POLICY "Users can create their own chat sessions"
  ON plan_chat_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own chat sessions
CREATE POLICY "Users can update their own chat sessions"
  ON plan_chat_sessions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own chat sessions
CREATE POLICY "Users can delete their own chat sessions"
  ON plan_chat_sessions
  FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE plan_chat_sessions IS 'Stores chat session metadata for organizing multiple conversations per plan/job';
COMMENT ON COLUMN plan_chat_sessions.title IS 'Chat session title (auto-generated from first message or user-provided)';

-- ============================================================================
-- ADD chat_id TO plan_chat_history
-- ============================================================================
ALTER TABLE plan_chat_history
ADD COLUMN IF NOT EXISTS chat_id UUID REFERENCES plan_chat_sessions(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_plan_chat_history_chat_id ON plan_chat_history(chat_id) WHERE chat_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_plan_chat_history_plan_chat ON plan_chat_history(plan_id, chat_id, created_at DESC);

-- ============================================================================
-- ADD chat_id TO plan_chat_messages (for backward compatibility)
-- ============================================================================
ALTER TABLE plan_chat_messages
ADD COLUMN IF NOT EXISTS chat_id UUID REFERENCES plan_chat_sessions(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_plan_chat_messages_chat_id ON plan_chat_messages(chat_id) WHERE chat_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_plan_chat_messages_plan_chat ON plan_chat_messages(plan_id, chat_id, created_at DESC);

-- ============================================================================
-- FUNCTION: Auto-update updated_at timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION update_chat_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE plan_chat_sessions
  SET updated_at = NOW(), last_message_at = NOW()
  WHERE id = NEW.chat_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update chat session timestamp when messages are added
CREATE TRIGGER update_chat_session_on_message
  AFTER INSERT ON plan_chat_history
  FOR EACH ROW
  WHEN (NEW.chat_id IS NOT NULL)
  EXECUTE FUNCTION update_chat_session_timestamp();

CREATE TRIGGER update_chat_session_on_message_legacy
  AFTER INSERT ON plan_chat_messages
  FOR EACH ROW
  WHEN (NEW.chat_id IS NOT NULL)
  EXECUTE FUNCTION update_chat_session_timestamp();

COMMENT ON FUNCTION update_chat_session_timestamp IS 'Automatically updates chat session timestamp when new messages are added';

