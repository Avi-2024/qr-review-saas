CREATE TABLE IF NOT EXISTS merchant_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organization_memberships (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES merchant_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'manager', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_memberships_user
  ON organization_memberships(user_id);

CREATE TABLE IF NOT EXISTS merchant_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES merchant_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  user_agent TEXT,
  ip_hash TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_merchant_sessions_user
  ON merchant_sessions(user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_merchant_sessions_token_active
  ON merchant_sessions(token_hash)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_review_events_created
  ON review_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qr_codes_location_active
  ON qr_codes(location_id, is_active);
CREATE INDEX IF NOT EXISTS idx_locations_org_active
  ON locations(organization_id, is_active);
