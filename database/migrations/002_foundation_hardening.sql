CREATE TABLE IF NOT EXISTS qr_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  public_token TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'generic',
  reference TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qr_codes_location_id ON qr_codes(location_id);

INSERT INTO qr_codes(location_id, public_token, name, source_type, reference)
SELECT id, 'mangal-counter-demo', 'Main Counter', 'counter', 'main-counter'
FROM locations
WHERE public_id = 'mangal-traders'
ON CONFLICT (public_token) DO UPDATE
SET location_id = EXCLUDED.location_id,
    name = EXCLUDED.name,
    source_type = EXCLUDED.source_type,
    reference = EXCLUDED.reference,
    is_active = TRUE,
    updated_at = NOW();

ALTER TABLE review_sessions
  ADD COLUMN IF NOT EXISTS qr_code_id UUID REFERENCES qr_codes(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS client_session_id UUID,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

UPDATE review_sessions AS sessions
SET qr_code_id = qr.id
FROM qr_codes AS qr
WHERE sessions.qr_code_id IS NULL
  AND qr.location_id = sessions.location_id
  AND qr.public_token = 'mangal-counter-demo';

UPDATE review_sessions
SET client_session_id = gen_random_uuid()
WHERE client_session_id IS NULL;

UPDATE review_sessions
SET expires_at = started_at + INTERVAL '60 minutes'
WHERE expires_at IS NULL;

ALTER TABLE review_sessions
  ALTER COLUMN qr_code_id SET NOT NULL,
  ALTER COLUMN client_session_id SET NOT NULL,
  ALTER COLUMN expires_at SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_review_sessions_qr_client
  ON review_sessions(qr_code_id, client_session_id);
CREATE INDEX IF NOT EXISTS idx_review_sessions_expires_at
  ON review_sessions(expires_at);

ALTER TABLE review_drafts
  ADD COLUMN IF NOT EXISTS request_id UUID;

UPDATE review_drafts
SET request_id = gen_random_uuid()
WHERE request_id IS NULL;

ALTER TABLE review_drafts
  ALTER COLUMN request_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_review_drafts_session_request
  ON review_drafts(session_id, request_id);

CREATE TABLE IF NOT EXISTS review_generation_requests (
  session_id UUID NOT NULL REFERENCES review_sessions(id) ON DELETE CASCADE,
  request_id UUID NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('processing', 'completed')),
  draft_id UUID REFERENCES review_drafts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (session_id, request_id)
);

ALTER TABLE review_events
  ADD COLUMN IF NOT EXISTS client_event_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS uq_review_events_client_event_id
  ON review_events(client_event_id)
  WHERE client_event_id IS NOT NULL;

ALTER TABLE review_draft_topics
  ADD COLUMN IF NOT EXISTS location_id UUID;

UPDATE review_draft_topics AS draft_topics
SET location_id = sessions.location_id
FROM review_drafts AS drafts
JOIN review_sessions AS sessions ON sessions.id = drafts.session_id
WHERE draft_topics.draft_id = drafts.id
  AND draft_topics.location_id IS NULL;

ALTER TABLE review_draft_topics
  ALTER COLUMN location_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_review_draft_topics_location_topic'
  ) THEN
    ALTER TABLE review_draft_topics
      ADD CONSTRAINT fk_review_draft_topics_location_topic
      FOREIGN KEY (location_id, topic_id)
      REFERENCES review_topics(location_id, id)
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_review_draft_topics_location
  ON review_draft_topics(location_id, topic_id);
