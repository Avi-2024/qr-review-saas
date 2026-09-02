CREATE OR REPLACE FUNCTION seed_default_review_topics()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO review_topics(id, location_id, label, icon, sort_order) VALUES
    ('quality', NEW.id, 'Product / Service Quality', '★', 10),
    ('staff', NEW.id, 'Staff Interaction', '🤝', 20),
    ('value', NEW.id, 'Pricing / Value', '◎', 30),
    ('availability', NEW.id, 'Availability', '✓', 40),
    ('cleanliness', NEW.id, 'Cleanliness', '✨', 50),
    ('speed', NEW.id, 'Service Speed', '⚡', 60)
  ON CONFLICT (location_id, id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_seed_default_review_topics ON locations;
CREATE TRIGGER trg_seed_default_review_topics
AFTER INSERT ON locations
FOR EACH ROW EXECUTE FUNCTION seed_default_review_topics();

INSERT INTO review_topics(id, location_id, label, icon, sort_order)
SELECT defaults.id, locations.id, defaults.label, defaults.icon, defaults.sort_order
FROM locations
CROSS JOIN (VALUES
  ('quality','Product / Service Quality','★',10),
  ('staff','Staff Interaction','🤝',20),
  ('value','Pricing / Value','◎',30),
  ('availability','Availability','✓',40),
  ('cleanliness','Cleanliness','✨',50),
  ('speed','Service Speed','⚡',60)
) AS defaults(id,label,icon,sort_order)
ON CONFLICT (location_id, id) DO NOTHING;
