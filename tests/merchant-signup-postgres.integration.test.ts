import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { PostgresMerchantSignupRepository } from "@/server/merchant/signup/postgres-signup-repository";
import { PostgresBillingRepository } from "@/server/billing/infrastructure/postgres-billing-repository";

const databaseUrl = process.env.DATABASE_URL;
const describeDb = databaseUrl ? describe : describe.skip;

describeDb("merchant signup PostgreSQL flow", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const signupRepo = new PostgresMerchantSignupRepository(pool);
  const billingRepo = new PostgresBillingRepository(pool);
  const suffix = randomUUID().slice(0, 8);
  const email = `trial-${suffix}@example.com`;
  let organizationId = "";
  let userId = "";

  afterAll(async () => {
    if (organizationId) await pool.query(`DELETE FROM organizations WHERE id=$1`, [organizationId]);
    if (userId) await pool.query(`DELETE FROM merchant_users WHERE id=$1`, [userId]);
    await pool.end();
  });

  it("atomically creates an owner workspace, session and seven-day trial", async () => {
    const identity = await signupRepo.createOwnerAccount({
      email,
      passwordHash: "test-hash-not-used-for-login",
      name: "Trial Owner",
      businessName: `Trial Business ${suffix}`,
      tokenHash: randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", ""),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    organizationId = identity.organizationId;
    userId = identity.userId;

    expect(identity).toMatchObject({
      email,
      name: "Trial Owner",
      role: "owner",
      onboardingStage: "business",
      onboardingCompletedAt: null,
    });

    const membership = await pool.query(
      `SELECT role FROM organization_memberships WHERE organization_id=$1 AND user_id=$2`,
      [organizationId, userId],
    );
    expect(membership.rows[0]?.role).toBe("owner");

    const session = await pool.query(
      `SELECT id FROM merchant_sessions WHERE organization_id=$1 AND user_id=$2 AND revoked_at IS NULL`,
      [organizationId, userId],
    );
    expect(session.rowCount).toBe(1);

    const subscription = await billingRepo.getSubscription(organizationId);
    expect(subscription).toMatchObject({ planCode: "starter", status: "trialing" });
    expect(subscription!.trialEndsAt.getTime() - subscription!.trialStartedAt.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
