import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { PostgresMerchantTopicRepository } from "@/server/merchant/topics/postgres-topic-repository";

const databaseUrl = process.env.DATABASE_URL;
const describeDb = databaseUrl ? describe : describe.skip;

describeDb("PostgresMerchantTopicRepository", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const repo = new PostgresMerchantTopicRepository(pool);
  const suffix = randomUUID().slice(0, 8);
  let orgOne = "";
  let orgTwo = "";
  let locationId = "";

  beforeAll(async () => {
    orgOne = (await pool.query(`INSERT INTO organizations(name) VALUES ($1) RETURNING id`, [`Topic Merchant ${suffix}`])).rows[0].id;
    orgTwo = (await pool.query(`INSERT INTO organizations(name) VALUES ($1) RETURNING id`, [`Other Topic Merchant ${suffix}`])).rows[0].id;
    locationId = (await pool.query(
      `INSERT INTO locations(organization_id,public_id,name,subtitle,google_place_id,google_review_url,is_active)
       VALUES ($1,$2,$3,'','place','https://example.test',TRUE) RETURNING id`,
      [orgOne, `topic-${suffix}`, "Topic Location"],
    )).rows[0].id;
  });

  afterAll(async () => {
    if (orgOne) await pool.query(`DELETE FROM organizations WHERE id=$1`, [orgOne]);
    if (orgTwo) await pool.query(`DELETE FROM organizations WHERE id=$1`, [orgTwo]);
    await pool.end();
  });

  it("keeps topics tenant scoped", async () => {
    const ownTopics = await repo.list(orgOne, locationId);
    expect(ownTopics).not.toBeNull();
    await expect(repo.list(orgTwo, locationId)).resolves.toBeNull();
  });

  it("archives omitted topics while preserving stable IDs and order", async () => {
    const before = await repo.list(orgOne, locationId);
    expect(before?.length).toBeGreaterThanOrEqual(6);
    const first = before![0];
    const second = before![1];
    const third = before![2];

    const saved = await repo.save(orgOne, locationId, [
      { id: third.id, label: "Third First", icon: third.icon, sortOrder: 10 },
      { id: first.id, label: "First Second", icon: first.icon, sortOrder: 20 },
      { id: second.id, label: "Second Third", icon: second.icon, sortOrder: 30 },
    ]);

    const active = saved!.filter((topic) => topic.isActive);
    const inactive = saved!.filter((topic) => !topic.isActive);
    expect(active.map((topic) => topic.id)).toEqual([third.id, first.id, second.id]);
    expect(active.map((topic) => topic.label)).toEqual(["Third First", "First Second", "Second Third"]);
    expect(inactive.length).toBeGreaterThanOrEqual(3);
    expect(inactive.every((topic) => !active.some((item) => item.id === topic.id))).toBe(true);
  });

  it("can restore an archived topic without creating a new historical identity", async () => {
    const current = await repo.list(orgOne, locationId);
    const active = current!.filter((topic) => topic.isActive);
    const archived = current!.find((topic) => !topic.isActive)!;

    const saved = await repo.save(orgOne, locationId, [
      { id: active[0].id, label: active[0].label, icon: active[0].icon, sortOrder: 10 },
      { id: active[1].id, label: active[1].label, icon: active[1].icon, sortOrder: 20 },
      { id: archived.id, label: archived.label, icon: archived.icon, sortOrder: 30 },
    ]);

    expect(saved!.find((topic) => topic.id === archived.id)?.isActive).toBe(true);
  });
});
