-- Location-specific sector override is optional. The organization sector remains
-- the default so existing merchants and QR codes do not require reconfiguration.
ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS business_type_override TEXT NULL;

ALTER TABLE locations
  ADD CONSTRAINT locations_business_type_override_format
  CHECK (business_type_override IS NULL OR business_type_override ~ '^[a-z0-9-]{2,60}$');
