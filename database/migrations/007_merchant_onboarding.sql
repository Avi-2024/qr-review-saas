ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS business_type TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_stage TEXT NOT NULL DEFAULT 'business',
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organizations_onboarding_stage_check'
  ) THEN
    ALTER TABLE organizations
      ADD CONSTRAINT organizations_onboarding_stage_check
      CHECK (onboarding_stage IN ('business','location','topics','qr','ready','complete'));
  END IF;
END $$;

-- Existing merchants that already have a location and QR are considered configured.
-- New organizations remain at the default `business` stage and enter the wizard.
UPDATE organizations o
SET onboarding_stage = 'complete',
    onboarding_completed_at = COALESCE(o.onboarding_completed_at, NOW()),
    updated_at = NOW()
WHERE o.onboarding_completed_at IS NULL
  AND EXISTS (
    SELECT 1 FROM locations l WHERE l.organization_id = o.id
  )
  AND EXISTS (
    SELECT 1
    FROM qr_codes q
    JOIN locations l ON l.id = q.location_id
    WHERE l.organization_id = o.id
  );

CREATE INDEX IF NOT EXISTS idx_organizations_onboarding_stage
  ON organizations(onboarding_stage)
  WHERE onboarding_completed_at IS NULL;
