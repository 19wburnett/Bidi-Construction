-- Migration: Add email template sharing support
-- Allows templates to be shared with multiple users

-- Create junction table for template sharing
CREATE TABLE IF NOT EXISTS email_template_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES email_templates(id) ON DELETE CASCADE,
  shared_with_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Ensure a user can only be shared a template once
  CONSTRAINT email_template_shares_unique UNIQUE (template_id, shared_with_user_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_email_template_shares_template_id ON email_template_shares(template_id);
CREATE INDEX IF NOT EXISTS idx_email_template_shares_shared_with_user_id ON email_template_shares(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_email_template_shares_created_by ON email_template_shares(created_by);

-- Enable RLS
ALTER TABLE email_template_shares ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_template_shares
-- Users can view shares where they are the shared user or the template owner
CREATE POLICY "Users can view their template shares"
  ON email_template_shares FOR SELECT
  USING (
    shared_with_user_id = auth.uid() OR
    template_id IN (
      SELECT id FROM email_templates WHERE user_id = auth.uid()
    )
  );

-- Template owners can create shares
CREATE POLICY "Template owners can share templates"
  ON email_template_shares FOR INSERT
  WITH CHECK (
    template_id IN (
      SELECT id FROM email_templates WHERE user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

-- Template owners can delete shares
CREATE POLICY "Template owners can unshare templates"
  ON email_template_shares FOR DELETE
  USING (
    template_id IN (
      SELECT id FROM email_templates WHERE user_id = auth.uid()
    )
  );

-- Add comments
COMMENT ON TABLE email_template_shares IS 'Junction table for sharing email templates with multiple users';
COMMENT ON COLUMN email_template_shares.template_id IS 'The template being shared';
COMMENT ON COLUMN email_template_shares.shared_with_user_id IS 'The user the template is shared with';
COMMENT ON COLUMN email_template_shares.created_by IS 'The user who created the share (usually the template owner)';
