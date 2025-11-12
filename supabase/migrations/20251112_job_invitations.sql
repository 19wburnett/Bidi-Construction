-- Job invitation system

CREATE TABLE IF NOT EXISTS job_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'collaborator' CHECK (role IN ('owner', 'collaborator')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'cancelled', 'expired')),
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_job_invitations_email ON job_invitations(email);
CREATE INDEX IF NOT EXISTS idx_job_invitations_status ON job_invitations(status);

CREATE TABLE IF NOT EXISTS job_invitation_jobs (
  invitation_id UUID NOT NULL REFERENCES job_invitations(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (invitation_id, job_id)
);

COMMENT ON TABLE job_invitations IS 'Admin-created invitations that allow new users to join and activate subscriptions';
COMMENT ON COLUMN job_invitations.role IS 'Default role assigned when the invitation is accepted';
COMMENT ON COLUMN job_invitations.status IS 'Invitation status: pending, accepted, cancelled, or expired';

COMMENT ON TABLE job_invitation_jobs IS 'Join table mapping invitations to the jobs they grant access to';

