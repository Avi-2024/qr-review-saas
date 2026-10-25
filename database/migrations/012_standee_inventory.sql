CREATE TABLE IF NOT EXISTS standee_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  standee_code TEXT NOT NULL,
  public_token TEXT NOT NULL UNIQUE,
  batch_name TEXT NOT NULL DEFAULT 'Batch #1',
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  qr_code_id UUID REFERENCES qr_codes(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'unassigned' CHECK (status IN ('unassigned', 'assigned', 'damaged', 'retired')),
  assigned_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_standee_org_code UNIQUE (organization_id, standee_code)
);

CREATE INDEX IF NOT EXISTS idx_standee_inventory_org_status
  ON standee_inventory(organization_id, status);

CREATE INDEX IF NOT EXISTS idx_standee_inventory_location
  ON standee_inventory(location_id);

CREATE INDEX IF NOT EXISTS idx_standee_inventory_token
  ON standee_inventory(public_token);

-- Seed initial batch for existing organizations so Super Admin has ready-to-test stock
DO $$
DECLARE
  org RECORD;
  loc RECORD;
  qr RECORD;
  i INTEGER;
  code_str TEXT;
  token_str TEXT;
BEGIN
  FOR org IN SELECT id FROM organizations LOOP
    -- Check if org already has standees
    IF NOT EXISTS (SELECT 1 FROM standee_inventory WHERE organization_id = org.id LIMIT 1) THEN
      -- Get primary location & QR if any
      SELECT id INTO loc FROM locations WHERE organization_id = org.id AND is_active = TRUE ORDER BY created_at ASC LIMIT 1;
      
      -- Seed 10 starter standees
      FOR i IN 1..10 LOOP
        code_str := 'ST-' || LPAD(i::TEXT, 3, '0');
        token_str := 'st-' || LPAD(i::TEXT, 3, '0');
        
        -- If it's ST-001 and location exists, bind to it as demo
        IF i = 1 AND loc.id IS NOT NULL THEN
          SELECT id INTO qr FROM qr_codes WHERE location_id = loc.id LIMIT 1;
          
          -- If qr exists with token_str, link it, otherwise create qr or link existing
          INSERT INTO standee_inventory (
            organization_id, standee_code, public_token, batch_name, location_id, qr_code_id, status, assigned_at
          ) VALUES (
            org.id, code_str, token_str, 'Initial Starter Batch', loc.id, qr.id, 'assigned', NOW()
          ) ON CONFLICT (public_token) DO NOTHING;
          
          -- Ensure a qr_code exists for this token
          INSERT INTO qr_codes (
            location_id, public_token, name, source_type, reference, is_active
          ) VALUES (
            loc.id, token_str, 'Counter Standee ' || code_str, 'standee', code_str, TRUE
          ) ON CONFLICT (public_token) DO UPDATE
            SET location_id = EXCLUDED.location_id,
                is_active = TRUE;
        ELSE
          INSERT INTO standee_inventory (
            organization_id, standee_code, public_token, batch_name, status
          ) VALUES (
            org.id, code_str, token_str, 'Initial Starter Batch', 'unassigned'
          ) ON CONFLICT (public_token) DO NOTHING;
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END $$;
