import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { PostgresReviewRepository } from "@/server/infrastructure/repositories/postgres-review-repository";

const connectionString = process.env.DATABASE_URL;
const describeDb = connectionString ? describe : describe.skip;

describeDb("tenant-safe public sector resolution", () => {
  const pool = new Pool({ connectionString });
  const repository = new PostgresReviewRepository(pool);
  const suffix = randomUUID().slice(0, 8);
  const organizationIds: string[] = [];
  const locationIds: string[] = [];

  beforeAll(async () => {
    for (const [i, sector] of ["restaurant-cafe", "healthcare"].entries()) {
      const org = await pool.query<{ id: string }>(
        "INSERT INTO organizations(name,business_type) VALUES ($1,$2) RETURNING id",
        [`Sector Merchant ${i} ${suffix}`, sector],
      );
      organizationIds.push(org.rows[0].id);
      const location = await pool.query<{ id: string }>(
        `INSERT INTO locations(organization_id, public_id, name, subtitle, google_place_id, google_review_url)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [org.rows[0].id, `sector-${i}-${suffix}`, `Sector Location ${i}`,
          "Share your experience", `place-${i}-${suffix}`,
          `https://search.google.com/local/writereview?placeid=place-${i}-${suffix}`],
      );
      locationIds.push(location.rows[0].id);
    }
  });

  afterAll(async () => {
    for (const id of organizationIds) await pool.query("DELETE FROM organizations WHERE id=$1", [id]);
    await pool.end();
  });

  it("uses the correct organization sector for each QR location", async () => {
    const restaurant = await repository.getLocationById(locationIds[0]);
    const clinic = await repository.getLocationById(locationIds[1]);
    expect(restaurant?.businessType).toBe("restaurant-cafe");
    expect(clinic?.businessType).toBe("healthcare");
    expect(restaurant?.name).toBe("Sector Location 0");
    expect(clinic?.name).toBe("Sector Location 1");
  });

  it("honors a location override without affecting another merchant", async () => {
    await pool.query("UPDATE locations SET business_type_override=$2 WHERE id=$1", [locationIds[0], "salon-beauty"]);
    const restaurantOverride = await repository.getLocationById(locationIds[0]);
    const unaffectedClinic = await repository.getLocationById(locationIds[1]);
    expect(restaurantOverride?.businessType).toBe("salon-beauty");
    expect(unaffectedClinic?.businessType).toBe("healthcare");
  });
});
