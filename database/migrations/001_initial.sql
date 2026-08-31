CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  public_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  google_place_id TEXT NOT NULL,
  google_review_url TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_locations_organization_id ON locations(organization_id);

CREATE TABLE IF NOT EXISTS review_topics (
  id TEXT NOT NULL,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (location_id, id)
);

CREATE TABLE IF NOT EXISTS review_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  user_agent TEXT,
  ip_hash TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_sessions_location_started
  ON review_sessions(location_id, started_at DESC);

CREATE TABLE IF NOT EXISTS review_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES review_sessions(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  note TEXT,
  draft_text TEXT NOT NULL,
  generation_provider TEXT NOT NULL,
  variation INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_drafts_session_created
  ON review_drafts(session_id, created_at DESC);

CREATE TABLE IF NOT EXISTS review_draft_topics (
  draft_id UUID NOT NULL REFERENCES review_drafts(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL,
  PRIMARY KEY (draft_id, topic_id)
);

CREATE TABLE IF NOT EXISTS review_events (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES review_sessions(id) ON DELETE CASCADE,
  review_draft_id UUID REFERENCES review_drafts(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_events_session_created
  ON review_events(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_events_type_created
  ON review_events(event_type, created_at DESC);

DO $$
DECLARE
  org_id UUID;
  loc_id UUID;
BEGIN
  SELECT id INTO org_id FROM organizations WHERE name = 'Mangal Traders' LIMIT 1;
  IF org_id IS NULL THEN
    INSERT INTO organizations(name) VALUES ('Mangal Traders') RETURNING id INTO org_id;
  END IF;

  SELECT id INTO loc_id FROM locations WHERE public_id = 'mangal-traders' LIMIT 1;
  IF loc_id IS NULL THEN
    INSERT INTO locations(
      organization_id, public_id, name, subtitle, google_place_id, google_review_url
    ) VALUES (
      org_id,
      'mangal-traders',
      'Mangal Traders',
      'Fast feedback. No login required.',
      'ChIJIxP2kbaJgzkR6h4dYXKWCcI',
      'https://search.google.com/local/writereview?placeid=ChIJIxP2kbaJgzkR6h4dYXKWCcI'
    ) RETURNING id INTO loc_id;
  END IF;

  INSERT INTO review_topics(id, location_id, label, icon, sort_order) VALUES
    ('quality', loc_id, 'Product Quality', '📦', 10),
    ('staff', loc_id, 'Staff Interaction', '🤝', 20),
    ('pricing', loc_id, 'Pricing', '₹', 30),
    ('availability', loc_id, 'Product Availability', '✓', 40),
    ('cleanliness', loc_id, 'Cleanliness', '✨', 50),
    ('speed', loc_id, 'Service Speed', '⚡', 60),
    ('variety', loc_id, 'Product Variety', '🛍️', 70),
    ('value', loc_id, 'Overall Value', '◎', 80)
  ON CONFLICT (location_id, id) DO UPDATE
    SET label = EXCLUDED.label,
        icon = EXCLUDED.icon,
        sort_order = EXCLUDED.sort_order,
        is_active = TRUE;
END $$;
