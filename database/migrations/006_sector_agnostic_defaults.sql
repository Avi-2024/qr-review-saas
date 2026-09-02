-- Keep the review engine usable across industries without requiring code changes.
-- Existing merchants can keep/customize their own topics; this migration only
-- normalizes known legacy default/demo labels.

CREATE OR REPLACE FUNCTION seed_default_review_topics()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO review_topics(id, location_id, label, icon, sort_order) VALUES
    ('quality', NEW.id, 'Overall Quality', '★', 10),
    ('staff', NEW.id, 'Staff / Support', '🤝', 20),
    ('value', NEW.id, 'Value / Pricing', '◎', 30),
    ('availability', NEW.id, 'Ease / Convenience', '✓', 40),
    ('cleanliness', NEW.id, 'Environment / Cleanliness', '✨', 50),
    ('speed', NEW.id, 'Speed / Timeliness', '⚡', 60)
  ON CONFLICT (location_id, id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Normalize only labels that came from the original built-in defaults/demo.
UPDATE review_topics
SET label = 'Overall Quality', icon = '★'
WHERE id = 'quality'
  AND label IN ('Product Quality', 'Product / Service Quality');

UPDATE review_topics
SET label = 'Staff / Support', icon = '🤝'
WHERE id = 'staff'
  AND label IN ('Staff Interaction');

UPDATE review_topics
SET label = 'Value / Pricing', icon = '◎'
WHERE id IN ('value', 'pricing')
  AND label IN ('Pricing', 'Pricing / Value', 'Overall Value');

UPDATE review_topics
SET label = 'Ease / Convenience', icon = '✓'
WHERE id = 'availability'
  AND label IN ('Availability', 'Product Availability');

UPDATE review_topics
SET label = 'Environment / Cleanliness', icon = '✨'
WHERE id = 'cleanliness'
  AND label = 'Cleanliness';

UPDATE review_topics
SET label = 'Speed / Timeliness', icon = '⚡'
WHERE id = 'speed'
  AND label = 'Service Speed';

-- Legacy demo-only retail topic. Keep the data for historical drafts but stop
-- showing it as an active default chip going forward.
UPDATE review_topics
SET is_active = FALSE
WHERE id = 'variety'
  AND label = 'Product Variety';
