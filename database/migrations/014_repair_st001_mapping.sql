-- Migration 014: Repair ST-001 mapping to ensure it correctly resolves to Mangal Traders
DO $$
DECLARE
  mangal_loc_id UUID;
  st001_qr_id UUID;
BEGIN
  -- 1. Locate Mangal Traders location
  SELECT id INTO mangal_loc_id 
  FROM locations 
  WHERE public_id = 'mangal-traders' OR name = 'Mangal Traders' 
  ORDER BY created_at ASC 
  LIMIT 1;

  IF mangal_loc_id IS NOT NULL THEN
    -- 2. Point QR code st-001 to Mangal Traders
    UPDATE qr_codes
    SET location_id = mangal_loc_id, is_active = TRUE
    WHERE public_token = 'st-001'
    RETURNING id INTO st001_qr_id;

    -- 3. Link standee_inventory ST-001 to this QR record and Mangal Traders location
    IF st001_qr_id IS NOT NULL THEN
      UPDATE standee_inventory
      SET qr_code_id = st001_qr_id,
          location_id = mangal_loc_id,
          status = 'assigned'
      WHERE standee_code = 'ST-001';
    END IF;
  END IF;
END $$;
