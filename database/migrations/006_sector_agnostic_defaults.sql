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
WHERE id = 'value'
  AND label IN ('Pricing / Value', 'Overall Value');

-- The original retail demo had both `pricing` and `value`. When the canonical
-- `value` topic exists, keep the old pricing row only for historical references
-- and stop showing it as a duplicate active chip.
UPDATE review_topics AS legacy
SET is_active = FALSE
WHERE legacy.id = 'pricing'
  AND legacy.label = 'Pricing'
  AND EXISTS (
    SELECT 1
    FROM review_topics AS canonical
    WHERE canonical.location_id = legacy.location_id
      AND canonical.id = 'value'
  );

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
