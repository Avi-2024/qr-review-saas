import type { Pool } from "pg";
import type { BillingRepository } from "@/server/billing/application/ports/billing-repository";
import type {
  BillingPlan,
  BillingUsage,
  OrganizationSubscription,
  SubscriptionStatus,
} from "@/server/billing/domain/billing";

function mapPlan(row: Record<string, unknown>): BillingPlan {
  return {
    code: String(row.code),
    name: String(row.name),
    monthlyPricePaise: Number(row.monthly_price_paise),
    yearlyPricePaise: Number(row.yearly_price_paise),
    maxLocations: Number(row.max_locations),
    maxQrCodes: Number(row.max_qr_codes),
    isActive: Boolean(row.is_active),
  };
}

function mapSubscription(row: Record<string, unknown>): OrganizationSubscription {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    planCode: String(row.plan_code),
    status: String(row.status) as SubscriptionStatus,
    trialStartedAt: new Date(String(row.trial_started_at)),
    trialEndsAt: new Date(String(row.trial_ends_at)),
    currentPeriodStart: row.current_period_start ? new Date(String(row.current_period_start)) : null,
    currentPeriodEnd: row.current_period_end ? new Date(String(row.current_period_end)) : null,
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
    provider: row.provider ? String(row.provider) : null,
    providerCustomerId: row.provider_customer_id ? String(row.provider_customer_id) : null,
    providerSubscriptionId: row.provider_subscription_id ? String(row.provider_subscription_id) : null,
  };
}

export class PostgresBillingRepository implements BillingRepository {
  constructor(private readonly pool: Pool) {}

  async getSubscription(organizationId: string) {
    const result = await this.pool.query(
      `SELECT *
       FROM organization_subscriptions
       WHERE organization_id = $1
       LIMIT 1`,
      [organizationId],
    );
    return result.rows[0] ? mapSubscription(result.rows[0]) : null;
  }

  async getPlan(code: string) {
    const result = await this.pool.query(
      `SELECT * FROM billing_plans WHERE code = $1 LIMIT 1`,
      [code],
    );
    return result.rows[0] ? mapPlan(result.rows[0]) : null;
  }

  async listPlans() {
    const result = await this.pool.query(
      `SELECT *
       FROM billing_plans
       WHERE is_active = TRUE
       ORDER BY monthly_price_paise ASC`,
    );
    return result.rows.map(mapPlan);
  }

  async getUsage(organizationId: string): Promise<BillingUsage> {
    const result = await this.pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM locations WHERE organization_id = $1) AS locations,
         (SELECT COUNT(*)::int
            FROM qr_codes q
            JOIN locations l ON l.id = q.location_id
           WHERE l.organization_id = $1) AS qr_codes`,
      [organizationId],
    );
    return {
      locations: Number(result.rows[0]?.locations ?? 0),
      qrCodes: Number(result.rows[0]?.qr_codes ?? 0),
    };
  }

  async getOrganizationIdForQrToken(qrToken: string) {
    const result = await this.pool.query(
      `SELECT l.organization_id
         FROM qr_codes q
         JOIN locations l ON l.id = q.location_id
        WHERE q.public_token = $1
          AND q.is_active = TRUE
          AND l.is_active = TRUE
        LIMIT 1`,
      [qrToken],
    );
    return result.rows[0]?.organization_id ? String(result.rows[0].organization_id) : null;
  }

  async updateSubscriptionStatus(organizationId: string, status: SubscriptionStatus) {
    const result = await this.pool.query(
      `UPDATE organization_subscriptions
          SET status = $2,
              updated_at = NOW()
        WHERE organization_id = $1
        RETURNING *`,
      [organizationId, status],
    );
    return result.rows[0] ? mapSubscription(result.rows[0]) : null;
  }
}
