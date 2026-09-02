import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { PostgresMerchantRepository } from "@/server/merchant/infrastructure/postgres-merchant-repository";

const databaseUrl = process.env.DATABASE_URL;
const describeDb = databaseUrl ? describe : describe.skip;

describeDb("PostgresMerchantRepository", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const repo = new PostgresMerchantRepository(pool);
  const suffix = randomUUID().slice(0, 8);
  let orgOne = "";
  let orgTwo = "";
  let locationId = "";
  let qrCodeId = "";

  beforeAll(async () => {
    orgOne = (await pool.query(`INSERT INTO organizations(name) VALUES ($1) RETURNING id`, [`Test Merchant ${suffix}`])).rows[0].id;
    orgTwo = (await pool.query(`INSERT INTO organizations(name) VALUES ($1) RETURNING id`, [`Other Merchant ${suffix}`])).rows[0].id;
  });

  afterAll(async () => {
    if (orgOne) await pool.query(`DELETE FROM organizations WHERE id=$1`, [orgOne]);
    if (orgTwo) await pool.query(`DELETE FROM organizations WHERE id=$1`, [orgTwo]);
    await pool.end();
  });

  it("keeps location data tenant scoped and seeds review topics", async () => {
    const created = await repo.createLocation(orgOne, {
      publicId: `test-${suffix}`,
      name: "Test Main Store",
      subtitle: "Quick feedback",
      googlePlaceId: `ChIJ-${suffix}`,
      googleReviewUrl: `https://search.google.com/local/writereview?placeid=ChIJ-${suffix}`,
      isActive: true,
    });
    locationId = created.id;
    await repo.createLocation(orgTwo, {
      publicId: `other-${suffix}`,
      name: "Other Store",
      subtitle: "Other",
      googlePlaceId: `Other-${suffix}`,
      googleReviewUrl: `https://search.google.com/local/writereview?placeid=Other-${suffix}`,
      isActive: true,
    });

    const locations = await repo.listLocations(orgOne);
    expect(locations).toHaveLength(1);
    expect(locations[0].name).toBe("Test Main Store");

    const topics = await pool.query(`SELECT id FROM review_topics WHERE location_id=$1 ORDER BY sort_order`, [locationId]);
    expect(topics.rows.length).toBeGreaterThanOrEqual(6);
  });

  it("creates QR assets only inside an active organization location", async () => {
    const qr = await repo.createQrCode(orgOne, {
      locationId,
      publicToken: `test-qr-${suffix}`,
      name: "Billing Counter",
      sourceType: "counter",
    });
    qrCodeId = qr.id;
    expect(qr.locationId).toBe(locationId);
    expect(qr.locationName).toBe("Test Main Store");

    const qrCodes = await repo.listQrCodes(orgTwo);
    expect(qrCodes.some((item) => item.id === qr.id)).toBe(false);
  });

  it("pauses child QR codes when a location is paused and excludes them from active counts", async () => {
    const updated = await repo.updateLocation(orgOne, locationId, { isActive: false });
    expect(updated?.isActive).toBe(false);

    const qr = await repo.getQrCode(orgOne, qrCodeId);
    expect(qr?.isActive).toBe(false);

    const summary = await repo.getDashboardSummary(orgOne, 30);
    expect(summary.locations).toBe(0);
    expect(summary.qrCodes).toBe(0);
  });

  it("rejects QR activation for an inactive location in repository and raw SQL paths", async () => {
    const activation = await repo.updateQrCodeStatus(orgOne, qrCodeId, true);
    expect(activation).toBeNull();

    await expect(repo.createQrCode(orgOne, {
      locationId,
      publicToken: `inactive-qr-${suffix}`,
      name: "Inactive Counter",
      sourceType: "counter",
    })).rejects.toThrow("Active location not found");

    await expect(pool.query(`UPDATE qr_codes SET is_active=TRUE WHERE id=$1`, [qrCodeId]))
      .rejects.toMatchObject({ code: "23514" });

    await expect(pool.query(
      `INSERT INTO qr_codes(location_id, public_token, name, source_type, is_active)
       VALUES ($1,$2,$3,$4,TRUE)`,
      [locationId, `raw-inactive-${suffix}`, "Raw Inactive", "counter"],
    )).rejects.toMatchObject({ code: "23514" });
  });

  it("can reactivate the location and then activate its QR code", async () => {
    const location = await repo.updateLocation(orgOne, locationId, { isActive: true });
    expect(location?.isActive).toBe(true);

    const qr = await repo.updateQrCodeStatus(orgOne, qrCodeId, true);
    expect(qr?.isActive).toBe(true);
  });

  it("returns zero-safe analytics for a merchant with no review events", async () => {
    const summary = await repo.getDashboardSummary(orgOne, 30);
    expect(summary.scans).toBe(0);
    expect(summary.googleOpens).toBe(0);
    expect(summary.conversionRate).toBe(0);

    const trend = await repo.getTrend(orgOne, 7);
    expect(trend).toHaveLength(7);
  });
});
