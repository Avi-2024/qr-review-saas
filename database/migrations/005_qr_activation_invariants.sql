-- Clean up any historical inconsistency before installing the invariant trigger.
UPDATE qr_codes AS q
SET is_active = FALSE,
    updated_at = NOW()
FROM locations AS l
WHERE q.location_id = l.id
  AND l.is_active = FALSE
  AND q.is_active = TRUE;

CREATE OR REPLACE FUNCTION pause_qr_codes_for_inactive_location()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_active = TRUE AND NEW.is_active = FALSE THEN
    UPDATE qr_codes
    SET is_active = FALSE,
        updated_at = NOW()
    WHERE location_id = NEW.id
      AND is_active = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pause_qr_codes_for_inactive_location ON locations;
CREATE TRIGGER trg_pause_qr_codes_for_inactive_location
AFTER UPDATE OF is_active ON locations
FOR EACH ROW
WHEN (OLD.is_active IS DISTINCT FROM NEW.is_active)
EXECUTE FUNCTION pause_qr_codes_for_inactive_location();

CREATE OR REPLACE FUNCTION prevent_active_qr_on_inactive_location()
RETURNS TRIGGER AS $$
DECLARE
  location_active BOOLEAN;
BEGIN
  IF NEW.is_active = TRUE THEN
    SELECT is_active INTO location_active
    FROM locations
    WHERE id = NEW.location_id;

    IF location_active IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'Cannot activate QR code for an inactive or missing location.'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_active_qr_on_inactive_location ON qr_codes;
CREATE TRIGGER trg_prevent_active_qr_on_inactive_location
BEFORE INSERT OR UPDATE OF is_active, location_id ON qr_codes
FOR EACH ROW
EXECUTE FUNCTION prevent_active_qr_on_inactive_location();
