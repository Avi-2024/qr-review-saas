ALTER TABLE organization_subscriptions
  ADD COLUMN IF NOT EXISTS billing_interval TEXT NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS provider_plan_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_status TEXT,
  ADD COLUMN IF NOT EXISTS last_provider_event_at TIMESTAMPTZ;

ALTER TABLE organization_subscriptions
  DROP CONSTRAINT IF EXISTS organization_subscriptions_billing_interval_check;
ALTER TABLE organization_subscriptions
  ADD CONSTRAINT organization_subscriptions_billing_interval_check
  CHECK (billing_interval IN ('monthly', 'yearly'));

ALTER TABLE billing_events
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS provider_event_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_events_provider_event
  ON billing_events(provider, provider_event_id)
  WHERE provider IS NOT NULL AND provider_event_id IS NOT NULL;

ALTER TABLE subscription_payments
  ADD COLUMN IF NOT EXISTS provider_invoice_id TEXT;

CREATE INDEX IF NOT EXISTS idx_subscription_payments_subscription_created
  ON subscription_payments(subscription_id, created_at DESC);
