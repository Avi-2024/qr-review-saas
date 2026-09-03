import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { PostgresQrPerformanceRepository } from "@/server/analytics/infrastructure/postgres-qr-performance-repository";

const databaseUrl = process.env.DATABASE_URL;
const describeDb = databaseUrl ? describe : describe.skip;

describeDb("PostgresQrPerformanceRepository", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const repo = new PostgresQrPerformanceRepository(pool);
  const suffix = randomUUID().slice(0, 8);
  let orgId = "";
  let otherOrgId = "";
  let locationId = "";
  let otherLocationId = "";
  let receptionQr = "";
  let billingQr = "";
  let unusedQr = "";

  async function createSession(qrCodeId: string, targetLocationId: string, events: string[]) {
    const session = (await pool.query<{ id: string }>(
      `INSERT INTO review_sessions(location_id, qr_code_id, client_session_id, expires_at)
       VALUES ($1,$2,$3,NOW()+INTERVAL '1 hour') RETURNING id`,
      [targetLocationId, qrCodeId, randomUUID()],
    )).rows[0];
    for (const event of events) {
      await pool.query(`INSERT INTO review_events(session_id,event_type) VALUES ($1,$2)`, [session.id, event]);
    }
  }

  beforeAll(async () => {
    orgId = (await pool.query(`INSERT INTO organizations(name) VALUES ($1) RETURNING id`, [`QR Analytics ${suffix}`])).rows[0].id;
    otherOrgId = (await pool.query(`INSERT INTO organizations(name) VALUES ($1) RETURNING id`, [`Other Analytics ${suffix}`])).rows[0].id;
    locationId = (await pool.query(
      `INSERT INTO locations(organization_id,public_id,name,google_place_id,google_review_url)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [orgId, `analytics-${suffix}`, "Main Branch", `Place-${suffix}`, `https://example.com/${suffix}`],
    )).rows[0].id;
    otherLocationId = (await pool.query(
      `INSERT INTO locations(organization_id,public_id,name,google_place_id,google_review_url)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [otherOrgId, `other-analytics-${suffix}`, "Other Branch", `Other-${suffix}`, `https://example.com/other-${suffix}`],
    )).rows[0].id;

    receptionQr = (await pool.query(`INSERT INTO qr_codes(location_id,public_token,name,source_type) VALUES ($1,$2,'Reception','reception') RETURNING id`, [locationId, `reception-${suffix}`])).rows[0].id;
    billingQr = (await pool.query(`INSERT INTO qr_codes(location_id,public_token,name,source_type) VALUES ($1,$2,'Billing','billing') RETURNING id`, [locationId, `billing-${suffix}`])).rows[0].id;
    unusedQr = (await pool.query(`INSERT INTO qr_codes(location_id,public_token,name,source_type) VALUES ($1,$2,'Exit','exit') RETURNING id`, [locationId, `exit-${suffix}`])).rows[0].id;
    const foreignQr = (await pool.query(`INSERT INTO qr_codes(location_id,public_token,name,source_type) VALUES ($1,$2,'Foreign','counter') RETURNING id`, [otherLocationId, `foreign-${suffix}`])).rows[0].id;

    for (let index = 0; index < 6; index += 1) {
      const events = ["QR_SCANNED"];
      if (index < 4) events.push("REVIEW_GENERATED");
      if (index < 3) events.push("GOOGLE_REVIEW_OPENED");
      await createSession(receptionQr, locationId, events);
    }
    for (let index = 0; index < 2; index += 1) {
      await createSession(billingQr, locationId, ["QR_SCANNED", "REVIEW_GENERATED", "GOOGLE_REVIEW_OPENED"]);
    }
    await createSession(foreignQr, otherLocationId, ["QR_SCANNED", "REVIEW_GENERATED", "GOOGLE_REVIEW_OPENED"]);

    await pool.query(`UPDATE qr_codes SET is_active=FALSE WHERE id=$1`, [billingQr]);
  });

  afterAll(async () => {
    if (orgId) await pool.query(`DELETE FROM organizations WHERE id=$1`, [orgId]);
    if (otherOrgId) await pool.query(`DELETE FROM organizations WHERE id=$1`, [otherOrgId]);
    await pool.end();
  });

  it("returns tenant-scoped metrics, keeps paused history, and includes zero-activity QR assets", async () => {
    const rows = await repo.listQrPerformance({ organizationId: orgId, days: 30 });
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.qrName)).toEqual(["Reception", "Billing", "Exit"]);

    const reception = rows.find((row) => row.qrCodeId === receptionQr)!;
    expect(reception.scans).toBe(6);
    expect(reception.reviewsGenerated).toBe(4);
    expect(reception.googleOpens).toBe(3);
    expect(reception.conversionRate).toBe(50);

    const billing = rows.find((row) => row.qrCodeId === billingQr)!;
    expect(billing.isActive).toBe(false);
    expect(billing.scans).toBe(2);
    expect(billing.conversionRate).toBe(100);

    const unused = rows.find((row) => row.qrCodeId === unusedQr)!;
    expect(unused.scans).toBe(0);
    expect(rows.some((row) => row.qrName === "Foreign")).toBe(false);
  });

  it("supports location filtering and reports complete QR attribution", async () => {
    const rows = await repo.listQrPerformance({ organizationId: orgId, days: 30, locationId });
    expect(rows).toHaveLength(3);
    const attribution = await repo.getAttributionSummary({ organizationId: orgId, days: 30 });
    expect(attribution.scans).toBe(8);
    expect(attribution.attributedScans).toBe(8);
    expect(attribution.unattributedScans).toBe(0);
    expect(attribution.attributionRate).toBe(100);
  });
});
