import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { PostgresBillingRepository } from "@/server/billing/infrastructure/postgres-billing-repository";

const databaseUrl = process.env.DATABASE_URL;
const describeDb = databaseUrl ? describe : describe.skip;

describeDb("billing PostgreSQL foundation", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const repo = new PostgresBillingRepository(pool);
  const suffix = randomUUID().slice(0, 8);
  let organizationId = "";

  beforeAll(async () => {
    const result = await pool.query<{ id: string }>(
      `INSERT INTO organizations(name) VALUES ($1) RETURNING id`,
      [`Billing Test ${suffix}`],
    );
    organizationId = result.rows[0].id;
  });

  afterAll(async () => {
    if (organizationId) await pool.query(`DELETE FROM organizations WHERE id=$1`, [organizationId]);
    await pool.end();
  });

  it("automatically provisions a seven-day Starter trial for a new organization", async () => {
    const subscription = await repo.getSubscription(organizationId);
    expect(subscription).not.toBeNull();
    expect(subscription).toMatchObject({
      organizationId,
      planCode: "starter",
      status: "trialing",
    });

    const durationMs = subscription!.trialEndsAt.getTime() - subscription!.trialStartedAt.getTime();
    expect(durationMs).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("returns seeded plan limits and prices", async () => {
    const plans = await repo.listPlans();
    expect(plans).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "starter", monthlyPricePaise: 49_900, maxLocations: 1, maxQrCodes: 5 }),
      expect.objectContaining({ code: "growth", monthlyPricePaise: 99_900, maxLocations: 3, maxQrCodes: 25 }),
      expect.objectContaining({ code: "business", monthlyPricePaise: 199_900, maxLocations: 10, maxQrCodes: 100 }),
    ]));
  });

  it("isolates usage by organization", async () => {
    const other = await pool.query<{ id: string }>(
      `INSERT INTO organizations(name) VALUES ($1) RETURNING id`,
      [`Billing Other ${suffix}`],
    );
    try {
      const usage = await repo.getUsage(organizationId);
      const otherUsage = await repo.getUsage(other.rows[0].id);
      expect(usage).toEqual({ locations: 0, qrCodes: 0 });
      expect(otherUsage).toEqual({ locations: 0, qrCodes: 0 });
    } finally {
      await pool.query(`DELETE FROM organizations WHERE id=$1`, [other.rows[0].id]);
    }
  });
});
