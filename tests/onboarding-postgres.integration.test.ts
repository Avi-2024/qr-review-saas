import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { PostgresMerchantRepository } from "@/server/merchant/infrastructure/postgres-merchant-repository";

const databaseUrl = process.env.DATABASE_URL;
const describeDb = databaseUrl ? describe : describe.skip;

describeDb("merchant onboarding PostgreSQL flow", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const repo = new PostgresMerchantRepository(pool);
  const suffix = randomUUID().slice(0, 8);
  let organizationId = "";
  let locationId = "";
  let qrId = "";

  beforeAll(async () => {
    const result = await pool.query<{ id: string }>(
      `INSERT INTO organizations(name) VALUES ($1) RETURNING id`,
      [`Onboarding ${suffix}`],
    );
    organizationId = result.rows[0].id;
  });

  afterAll(async () => {
    if (organizationId) await pool.query(`DELETE FROM organizations WHERE id=$1`, [organizationId]);
    await pool.end();
  });

  it("starts a new organization at the business stage", async () => {
    const profile = await repo.getOrganizationProfile(organizationId);
    expect(profile).toMatchObject({
      name: `Onboarding ${suffix}`,
      businessType: null,
      onboardingStage: "business",
      onboardingCompletedAt: null,
    });
  });

  it("saves business profile and advances to location", async () => {
    const profile = await repo.saveOnboardingBusiness(organizationId, {
      name: `Happy Paws ${suffix}`,
      businessType: "Pet grooming and daycare",
    });
    expect(profile).toMatchObject({
      name: `Happy Paws ${suffix}`,
      businessType: "Pet grooming and daycare",
      onboardingStage: "location",
    });
  });

  it("creates exactly one onboarding location and advances atomically", async () => {
    const location = await repo.createOnboardingLocation(organizationId, {
      publicId: `happy-paws-${suffix}`,
      name: "Main Location",
      subtitle: "Share your experience in a few taps.",
      googlePlaceId: `ChIJ-${suffix}`,
      googleReviewUrl: `https://search.google.com/local/writereview?placeid=ChIJ-${suffix}`,
      isActive: true,
    });
    expect(location).not.toBeNull();
    locationId = location!.id;

    const profile = await repo.getOrganizationProfile(organizationId);
    expect(profile?.onboardingStage).toBe("topics");

    const replay = await repo.createOnboardingLocation(organizationId, {
      publicId: `duplicate-${suffix}`,
      name: "Duplicate",
      subtitle: "Duplicate",
      googlePlaceId: `Duplicate-${suffix}`,
      googleReviewUrl: `https://example.com/${suffix}`,
      isActive: true,
    });
    expect(replay).toBeNull();

    const locations = await repo.listLocations(organizationId);
    expect(locations).toHaveLength(1);
  });

  it("replaces defaults with customizable topics and advances to QR", async () => {
    const seeded = await repo.listLocationTopics(organizationId, locationId);
    expect(seeded.length).toBeGreaterThanOrEqual(6);

    const topics = await repo.replaceOnboardingTopics(organizationId, locationId, [
      { label: "Care Quality", icon: "★" },
      { label: "Staff", icon: "🤝" },
      { label: "Convenience", icon: "✓" },
      { label: "Cleanliness", icon: "✨" },
    ]);

    expect(topics?.map((topic) => topic.label)).toEqual(["Care Quality", "Staff", "Convenience", "Cleanliness"]);
    expect((await repo.getOrganizationProfile(organizationId))?.onboardingStage).toBe("qr");
  });

  it("creates the first QR and advances to ready without allowing a duplicate step", async () => {
    const qr = await repo.createOnboardingQrCode(organizationId, {
      locationId,
      publicToken: `reception-${suffix}`,
      name: "Reception",
      sourceType: "reception",
    });
    expect(qr).not.toBeNull();
    qrId = qr!.id;
    expect((await repo.getOrganizationProfile(organizationId))?.onboardingStage).toBe("ready");

    const replay = await repo.createOnboardingQrCode(organizationId, {
      locationId,
      publicToken: `duplicate-qr-${suffix}`,
      name: "Duplicate QR",
      sourceType: "duplicate",
    });
    expect(replay).toBeNull();

    expect((await repo.listQrCodes(organizationId))).toHaveLength(1);
  });

  it("completes only after an active location and active QR exist", async () => {
    const completed = await repo.completeOnboarding(organizationId);
    expect(completed?.onboardingStage).toBe("complete");
    expect(completed?.onboardingCompletedAt).toBeInstanceOf(Date);

    const idempotent = await repo.completeOnboarding(organizationId);
    expect(idempotent?.onboardingStage).toBe("complete");
    expect(idempotent?.onboardingCompletedAt).toBeInstanceOf(Date);

    const qr = await repo.getQrCode(organizationId, qrId);
    expect(qr?.isActive).toBe(true);
  });
});
