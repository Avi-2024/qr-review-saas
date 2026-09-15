CREATE TABLE IF NOT EXISTS billing_plans (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  monthly_price_paise INTEGER NOT NULL CHECK (monthly_price_paise >= 0),
  yearly_price_paise INTEGER NOT NULL CHECK (yearly_price_paise >= 0),
  max_locations INTEGER NOT NULL CHECK (max_locations > 0),
  max_qr_codes INTEGER NOT NULL CHECK (max_qr_codes > 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO billing_plans(
  code, name, monthly_price_paise, yearly_price_paise, max_locations, max_qr_codes
) VALUES
  ('starter', 'Starter', 49900, 499000, 1, 5),
  ('growth', 'Growth', 99900, 999000, 3, 25),
  ('business', 'Business', 199900, 1999000, 10, 100)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  monthly_price_paise = EXCLUDED.monthly_price_paise,
  yearly_price_paise = EXCLUDED.yearly_price_paise,
  max_locations = EXCLUDED.max_locations,
  max_qr_codes = EXCLUDED.max_qr_codes,
  is_active = TRUE,
  updated_at = NOW();

CREATE TABLE IF NOT EXISTS organization_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  plan_code TEXT NOT NULL REFERENCES billing_plans(code),
  status TEXT NOT NULL CHECK (status IN ('trialing', 'active', 'past_due', 'cancelled', 'expired', 'suspended')),
  trial_started_at TIMESTAMPTZ NOT NULL,
  trial_ends_at TIMESTAMPTZ NOT NULL,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  provider TEXT,
  provider_customer_id TEXT,
  provider_subscription_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_organization_subscriptions_provider_subscription
  ON organization_subscriptions(provider, provider_subscription_id)
  WHERE provider IS NOT NULL AND provider_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_organization_subscriptions_status_trial
  ON organization_subscriptions(status, trial_ends_at);

CREATE TABLE IF NOT EXISTS subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES organization_subscriptions(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  provider_payment_id TEXT,
  amount_paise INTEGER NOT NULL CHECK (amount_paise >= 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL CHECK (status IN ('created', 'authorized', 'captured', 'failed', 'refunded')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_subscription_payments_provider_payment
  ON subscription_payments(provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subscription_payments_org_created
  ON subscription_payments(organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS billing_events (
  id BIGSERIAL PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES organization_subscriptions(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_events_org_created
  ON billing_events(organization_id, created_at DESC);

INSERT INTO organization_subscriptions(
  organization_id,
  plan_code,
  status,
  trial_started_at,
  trial_ends_at
)
SELECT
  o.id,
  'starter',
  'trialing',
  NOW(),
  NOW() + INTERVAL '7 days'
FROM organizations o
ON CONFLICT (organization_id) DO NOTHING;

CREATE OR REPLACE FUNCTION ensure_default_organization_trial()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO organization_subscriptions(
    organization_id,
    plan_code,
    status,
    trial_started_at,
    trial_ends_at
  ) VALUES (
    NEW.id,
    'starter',
    'trialing',
    NOW(),
    NOW() + INTERVAL '7 days'
  )
  ON CONFLICT (organization_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS organizations_default_trial ON organizations;
CREATE TRIGGER organizations_default_trial
AFTER INSERT ON organizations
FOR EACH ROW EXECUTE FUNCTION ensure_default_organization_trial();
