CREATE INDEX IF NOT EXISTS idx_review_sessions_qr_started
  ON review_sessions(qr_code_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_review_events_session_type
  ON review_events(session_id, event_type);
