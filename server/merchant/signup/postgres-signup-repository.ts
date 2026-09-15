import type { Pool } from "pg";
import type { MerchantIdentity, MerchantOnboardingStage, MerchantRole } from "@/server/merchant/domain/merchant";
import type { MerchantSignupRepository } from "@/server/merchant/signup/signup-repository";

function mapIdentity(row: Record<string, unknown>): MerchantIdentity {
  return {
    userId: String(row.user_id),
    email: String(row.email),
    name: String(row.user_name),
    organizationId: String(row.organization_id),
    organizationName: String(row.organization_name),
    businessType: row.business_type ? String(row.business_type) : null,
    onboardingStage: String(row.onboarding_stage) as MerchantOnboardingStage,
    onboardingCompletedAt: row.onboarding_completed_at ? new Date(String(row.onboarding_completed_at)) : null,
    role: String(row.role) as MerchantRole,
  };
}

export class PostgresMerchantSignupRepository implements MerchantSignupRepository {
  constructor(private readonly pool: Pool) {}

  async createOwnerAccount(input: {
    email: string;
    passwordHash: string;
    name: string;
    businessName: string;
    tokenHash: string;
    expiresAt: Date;
    userAgent?: string;
    ipHash?: string;
  }) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const organizationResult = await client.query(
        `INSERT INTO organizations(name)
         VALUES ($1)
         RETURNING id, name, business_type, onboarding_stage, onboarding_completed_at`,
        [input.businessName],
      );
      const organization = organizationResult.rows[0];

      const userResult = await client.query(
        `INSERT INTO merchant_users(email, password_hash, name)
         VALUES ($1, $2, $3)
         RETURNING id, email, name`,
        [input.email, input.passwordHash, input.name],
      );
      const user = userResult.rows[0];

      await client.query(
        `INSERT INTO organization_memberships(organization_id, user_id, role)
         VALUES ($1, $2, 'owner')`,
        [organization.id, user.id],
      );

      await client.query(
        `INSERT INTO merchant_sessions(
           user_id, organization_id, token_hash, user_agent, ip_hash, expires_at
         ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          user.id,
          organization.id,
          input.tokenHash,
          input.userAgent ?? null,
          input.ipHash ?? null,
          input.expiresAt,
        ],
      );

      await client.query("COMMIT");

      return mapIdentity({
        user_id: user.id,
        email: user.email,
        user_name: user.name,
        organization_id: organization.id,
        organization_name: organization.name,
        business_type: organization.business_type,
        onboarding_stage: organization.onboarding_stage,
        onboarding_completed_at: organization.onboarding_completed_at,
        role: "owner",
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
