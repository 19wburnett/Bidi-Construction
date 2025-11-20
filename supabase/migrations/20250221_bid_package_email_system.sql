-- Migration: Bid Package Email System
-- Creates tables for email tracking, attachments, and enhanced features

-- 1. Create or update bid_package_recipients table
CREATE TABLE IF NOT EXISTS bid_package_recipients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bid_package_id UUID NOT NULL REFERENCES bid_packages(id) ON DELETE CASCADE,
  subcontractor_id UUID REFERENCES subcontractors(id) ON DELETE SET NULL,
  subcontractor_email TEXT NOT NULL,
  subcontractor_name TEXT,
  resend_email_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'bounced', 'failed', 'responded')),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  response_text TEXT,
  has_clarifying_questions BOOLEAN DEFAULT FALSE,
  clarifying_questions TEXT[],
  bid_id UUID REFERENCES bids(id) ON DELETE SET NULL,
  reminder_count INTEGER DEFAULT 0,
  last_reminder_sent_at TIMESTAMPTZ,
  reminder_schedule JSONB,
  thread_id TEXT,
  parent_email_id UUID REFERENCES bid_package_recipients(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  viewed_at TIMESTAMPTZ -- Preserve existing column
);

-- Add missing columns if table already exists
DO $$
BEGIN
  -- Add subcontractor_id if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bid_package_recipients' AND column_name = 'subcontractor_id') THEN
    ALTER TABLE bid_package_recipients ADD COLUMN subcontractor_id UUID REFERENCES subcontractors(id) ON DELETE SET NULL;
  END IF;

  -- Add resend_email_id if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bid_package_recipients' AND column_name = 'resend_email_id') THEN
    ALTER TABLE bid_package_recipients ADD COLUMN resend_email_id TEXT;
  END IF;

  -- Add status column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bid_package_recipients' AND column_name = 'status') THEN
    ALTER TABLE bid_package_recipients ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';
  END IF;

  -- Update status column constraint if it doesn't have the check constraint
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints 
                 WHERE constraint_name LIKE '%bid_package_recipients_status%') THEN
    -- First, update any existing status values to match our enum
    UPDATE bid_package_recipients SET status = 'pending' WHERE status IS NULL OR status NOT IN ('pending', 'sent', 'delivered', 'opened', 'bounced', 'failed', 'responded');
    -- Then add the constraint
    ALTER TABLE bid_package_recipients 
      ALTER COLUMN status SET DEFAULT 'pending',
      ADD CONSTRAINT bid_package_recipients_status_check 
      CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'bounced', 'failed', 'responded'));
  END IF;

  -- Add delivered_at if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bid_package_recipients' AND column_name = 'delivered_at') THEN
    ALTER TABLE bid_package_recipients ADD COLUMN delivered_at TIMESTAMPTZ;
  END IF;

  -- Add opened_at if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bid_package_recipients' AND column_name = 'opened_at') THEN
    ALTER TABLE bid_package_recipients ADD COLUMN opened_at TIMESTAMPTZ;
  END IF;

  -- Add bounced_at if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bid_package_recipients' AND column_name = 'bounced_at') THEN
    ALTER TABLE bid_package_recipients ADD COLUMN bounced_at TIMESTAMPTZ;
  END IF;

  -- Add response_text if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bid_package_recipients' AND column_name = 'response_text') THEN
    ALTER TABLE bid_package_recipients ADD COLUMN response_text TEXT;
  END IF;

  -- Add has_clarifying_questions if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bid_package_recipients' AND column_name = 'has_clarifying_questions') THEN
    ALTER TABLE bid_package_recipients ADD COLUMN has_clarifying_questions BOOLEAN DEFAULT FALSE;
  END IF;

  -- Add clarifying_questions if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bid_package_recipients' AND column_name = 'clarifying_questions') THEN
    ALTER TABLE bid_package_recipients ADD COLUMN clarifying_questions TEXT[];
  END IF;

  -- Add bid_id if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bid_package_recipients' AND column_name = 'bid_id') THEN
    ALTER TABLE bid_package_recipients ADD COLUMN bid_id UUID REFERENCES bids(id) ON DELETE SET NULL;
  END IF;

  -- Add reminder_count if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bid_package_recipients' AND column_name = 'reminder_count') THEN
    ALTER TABLE bid_package_recipients ADD COLUMN reminder_count INTEGER DEFAULT 0;
  END IF;

  -- Add last_reminder_sent_at if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bid_package_recipients' AND column_name = 'last_reminder_sent_at') THEN
    ALTER TABLE bid_package_recipients ADD COLUMN last_reminder_sent_at TIMESTAMPTZ;
  END IF;

  -- Add reminder_schedule if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bid_package_recipients' AND column_name = 'reminder_schedule') THEN
    ALTER TABLE bid_package_recipients ADD COLUMN reminder_schedule JSONB;
  END IF;

  -- Add thread_id if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bid_package_recipients' AND column_name = 'thread_id') THEN
    ALTER TABLE bid_package_recipients ADD COLUMN thread_id TEXT;
  END IF;

  -- Add parent_email_id if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bid_package_recipients' AND column_name = 'parent_email_id') THEN
    ALTER TABLE bid_package_recipients ADD COLUMN parent_email_id UUID REFERENCES bid_package_recipients(id) ON DELETE SET NULL;
  END IF;

  -- Ensure viewed_at exists (preserve if already exists)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bid_package_recipients' AND column_name = 'viewed_at') THEN
    ALTER TABLE bid_package_recipients ADD COLUMN viewed_at TIMESTAMPTZ;
  END IF;
END $$;

-- 2. Create email_templates table FIRST (needed for foreign key reference)
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  template_type TEXT NOT NULL CHECK (template_type IN ('bid_package', 'reminder', 'response')),
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  text_body TEXT,
  variables JSONB DEFAULT '[]'::jsonb,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create bid_attachments table
CREATE TABLE IF NOT EXISTS bid_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bid_id UUID NOT NULL REFERENCES bids(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Add fields to bid_packages table (now email_templates exists)
ALTER TABLE bid_packages
  ADD COLUMN IF NOT EXISTS auto_reminder_enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS reminder_schedule JSONB DEFAULT '[3, 7, 14]'::jsonb,
  ADD COLUMN IF NOT EXISTS auto_close_enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS final_reminder_sent BOOLEAN DEFAULT FALSE;

-- Add template_id column separately to handle foreign key properly
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bid_packages' AND column_name = 'template_id') THEN
    ALTER TABLE bid_packages 
      ADD COLUMN template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 5. Create quick_reply_templates table
CREATE TABLE IF NOT EXISTS quick_reply_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Create email_threads table
CREATE TABLE IF NOT EXISTS email_threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bid_package_id UUID NOT NULL REFERENCES bid_packages(id) ON DELETE CASCADE,
  subcontractor_email TEXT NOT NULL,
  thread_id TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Update notifications table (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notifications') THEN
    ALTER TABLE notifications
      ADD COLUMN IF NOT EXISTS notification_type TEXT,
      ADD COLUMN IF NOT EXISTS bid_package_id UUID REFERENCES bid_packages(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES bid_package_recipients(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bid_package_recipients_bid_package_id ON bid_package_recipients(bid_package_id);
CREATE INDEX IF NOT EXISTS idx_bid_package_recipients_subcontractor_email ON bid_package_recipients(subcontractor_email);
CREATE INDEX IF NOT EXISTS idx_bid_package_recipients_status ON bid_package_recipients(status);
CREATE INDEX IF NOT EXISTS idx_bid_package_recipients_resend_email_id ON bid_package_recipients(resend_email_id);
CREATE INDEX IF NOT EXISTS idx_bid_package_recipients_thread_id ON bid_package_recipients(thread_id);
CREATE INDEX IF NOT EXISTS idx_bid_attachments_bid_id ON bid_attachments(bid_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_user_id ON email_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_template_type ON email_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_quick_reply_templates_user_id ON quick_reply_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_bid_package_id ON email_threads(bid_package_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_thread_id ON email_threads(thread_id);

-- Enable Row Level Security
ALTER TABLE bid_package_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE bid_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE quick_reply_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_threads ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bid_package_recipients
CREATE POLICY "Users can view recipients for their bid packages"
  ON bid_package_recipients FOR SELECT
  USING (
    bid_package_id IN (
      SELECT id FROM bid_packages WHERE job_id IN (
        SELECT id FROM jobs WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can create recipients for their bid packages"
  ON bid_package_recipients FOR INSERT
  WITH CHECK (
    bid_package_id IN (
      SELECT id FROM bid_packages WHERE job_id IN (
        SELECT id FROM jobs WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update recipients for their bid packages"
  ON bid_package_recipients FOR UPDATE
  USING (
    bid_package_id IN (
      SELECT id FROM bid_packages WHERE job_id IN (
        SELECT id FROM jobs WHERE user_id = auth.uid()
      )
    )
  );

-- RLS Policies for bid_attachments
CREATE POLICY "Users can view attachments for their bids"
  ON bid_attachments FOR SELECT
  USING (
    bid_id IN (
      SELECT id FROM bids WHERE job_id IN (
        SELECT id FROM jobs WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "System can create attachments"
  ON bid_attachments FOR INSERT
  WITH CHECK (true);

-- RLS Policies for email_templates
CREATE POLICY "Users can manage their own email templates"
  ON email_templates FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for quick_reply_templates
CREATE POLICY "Users can manage their own quick reply templates"
  ON quick_reply_templates FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for email_threads
CREATE POLICY "Users can view threads for their bid packages"
  ON email_threads FOR SELECT
  USING (
    bid_package_id IN (
      SELECT id FROM bid_packages WHERE job_id IN (
        SELECT id FROM jobs WHERE user_id = auth.uid()
      )
    )
  );

-- Create function to update updated_at timestamp for email_templates
CREATE OR REPLACE FUNCTION update_email_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_email_templates_updated_at();

-- Create storage bucket for bid attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('bid-attachments', 'bid-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for bid-attachments bucket
CREATE POLICY "Users can upload bid attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'bid-attachments' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view bid attachments for their bids"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'bid-attachments' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete bid attachments"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'bid-attachments' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

