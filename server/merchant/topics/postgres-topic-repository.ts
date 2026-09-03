import type { Pool, PoolClient } from "pg";
import type { MerchantTopicConfig } from "@/server/merchant/domain/merchant";
import type { MerchantTopicRepository } from "@/server/merchant/topics/topic-repository";

const TOPIC_SELECT = `
  SELECT id, label, icon, sort_order AS "sortOrder", is_active AS "isActive"
  FROM review_topics`;

async function rollbackQuietly(client: PoolClient) {
  await client.query("ROLLBACK").catch(() => undefined);
}

export class PostgresMerchantTopicRepository implements MerchantTopicRepository {
  constructor(private readonly pool: Pool) {}

  async list(organizationId: string, locationId: string): Promise<MerchantTopicConfig[] | null> {
    const location = await this.pool.query<{ id: string }>(
      `SELECT id FROM locations WHERE id=$1 AND organization_id=$2 LIMIT 1`,
      [locationId, organizationId],
    );
    if (!location.rows[0]) return null;

    const topics = await this.pool.query<MerchantTopicConfig>(
      `${TOPIC_SELECT} WHERE location_id=$1 ORDER BY is_active DESC, sort_order, id`,
      [locationId],
    );
    return topics.rows;
  }

  async save(
    organizationId: string,
    locationId: string,
    topics: Array<{ id: string; label: string; icon: string; sortOrder: number }>,
  ): Promise<MerchantTopicConfig[] | null> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const location = await client.query<{ id: string }>(
        `SELECT id FROM locations WHERE id=$1 AND organization_id=$2 LIMIT 1 FOR UPDATE`,
        [locationId, organizationId],
      );
      if (!location.rows[0]) {
        await rollbackQuietly(client);
        return null;
      }

      await client.query(`UPDATE review_topics SET is_active=FALSE WHERE location_id=$1`, [locationId]);

      for (const topic of topics) {
        await client.query(
          `INSERT INTO review_topics(id, location_id, label, icon, sort_order, is_active)
           VALUES ($1,$2,$3,$4,$5,TRUE)
           ON CONFLICT (location_id,id) DO UPDATE
           SET label=EXCLUDED.label,
               icon=EXCLUDED.icon,
               sort_order=EXCLUDED.sort_order,
               is_active=TRUE`,
          [topic.id, locationId, topic.label, topic.icon, topic.sortOrder],
        );
      }

      const result = await client.query<MerchantTopicConfig>(
        `${TOPIC_SELECT} WHERE location_id=$1 ORDER BY is_active DESC, sort_order, id`,
        [locationId],
      );
      await client.query("COMMIT");
      return result.rows;
    } catch (error) {
      await rollbackQuietly(client);
      throw error;
    } finally {
      client.release();
    }
  }
}
