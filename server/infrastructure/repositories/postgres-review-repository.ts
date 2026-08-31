import type { Pool, PoolClient } from "pg";
import type { ReviewRepository } from "@/server/application/ports/review-repository";
import type {
  CreateSessionInput,
  LocationConfig,
  RecordEventInput,
  ReviewDraft,
  ReviewSession,
  SaveDraftInput,
} from "@/server/domain/review";

interface LocationRow {
  id: string;
  public_id: string;
  name: string;
  subtitle: string;
  google_place_id: string;
  google_review_url: string;
}

interface TopicRow {
  id: string;
  label: string;
  icon: string;
  sort_order: number;
}

export class PostgresReviewRepository implements ReviewRepository {
  constructor(private readonly pool: Pool) {}

  async getLocationByPublicId(publicId: string) {
    const result = await this.pool.query<LocationRow>(
      `SELECT id, public_id, name, subtitle, google_place_id, google_review_url
       FROM locations
       WHERE public_id = $1 AND is_active = TRUE
       LIMIT 1`,
      [publicId],
    );
    return this.hydrateLocation(result.rows[0] ?? null);
  }

  async getLocationById(id: string) {
    const result = await this.pool.query<LocationRow>(
      `SELECT id, public_id, name, subtitle, google_place_id, google_review_url
       FROM locations
       WHERE id = $1 AND is_active = TRUE
       LIMIT 1`,
      [id],
    );
    return this.hydrateLocation(result.rows[0] ?? null);
  }

  async createSession(input: CreateSessionInput) {
    const result = await this.pool.query<ReviewSession>(
      `INSERT INTO review_sessions (location_id, user_agent, ip_hash)
       VALUES ($1, $2, $3)
       RETURNING id, location_id AS "locationId", started_at AS "startedAt"`,
      [input.locationId, input.userAgent ?? null, input.ipHash ?? null],
    );
    return result.rows[0];
  }

  async getSession(id: string) {
    const result = await this.pool.query<ReviewSession>(
      `SELECT id, location_id AS "locationId", started_at AS "startedAt"
       FROM review_sessions
       WHERE id = $1
       LIMIT 1`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async saveDraft(input: SaveDraftInput) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<ReviewDraft>(
        `INSERT INTO review_drafts
           (session_id, rating, note, draft_text, generation_provider, variation)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING
           id,
           session_id AS "sessionId",
           rating,
           note,
           draft_text AS text,
           generation_provider AS provider,
           variation,
           created_at AS "createdAt"`,
        [input.sessionId, input.rating, input.note?.trim() || null, input.text, input.provider, input.variation],
      );

      await this.insertDraftTopics(client, result.rows[0].id, input.topicIds);
      await client.query("COMMIT");
      return { ...result.rows[0], topicIds: [...input.topicIds] };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getDraft(id: string) {
    const result = await this.pool.query<Omit<ReviewDraft, "topicIds">>(
      `SELECT
         id,
         session_id AS "sessionId",
         rating,
         note,
         draft_text AS text,
         generation_provider AS provider,
         variation,
         created_at AS "createdAt"
       FROM review_drafts
       WHERE id = $1
       LIMIT 1`,
      [id],
    );
    const draft = result.rows[0];
    if (!draft) return null;

    const topics = await this.pool.query<{ topic_id: string }>(
      `SELECT topic_id FROM review_draft_topics WHERE draft_id = $1`,
      [id],
    );

    return { ...draft, topicIds: topics.rows.map((row) => row.topic_id) } as ReviewDraft;
  }

  async recordEvent(input: RecordEventInput) {
    await this.pool.query(
      `INSERT INTO review_events (session_id, review_draft_id, event_type, metadata)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [input.sessionId, input.draftId ?? null, input.type, JSON.stringify(input.metadata ?? {})],
    );
  }

  private async hydrateLocation(row: LocationRow | null): Promise<LocationConfig | null> {
    if (!row) return null;
    const topics = await this.pool.query<TopicRow>(
      `SELECT id, label, icon, sort_order
       FROM review_topics
       WHERE location_id = $1 AND is_active = TRUE
       ORDER BY sort_order ASC`,
      [row.id],
    );

    return {
      id: row.id,
      publicId: row.public_id,
      name: row.name,
      subtitle: row.subtitle,
      googlePlaceId: row.google_place_id,
      googleReviewUrl: row.google_review_url,
      topics: topics.rows.map((topic) => ({
        id: topic.id,
        label: topic.label,
        icon: topic.icon,
        sortOrder: topic.sort_order,
      })),
    };
  }

  private async insertDraftTopics(client: PoolClient, draftId: string, topicIds: string[]) {
    if (!topicIds.length) return;
    const values: unknown[] = [draftId];
    const tuples = topicIds.map((topicId, index) => {
      values.push(topicId);
      return `($1, $${index + 2})`;
    });
    await client.query(
      `INSERT INTO review_draft_topics (draft_id, topic_id) VALUES ${tuples.join(", ")}`,
      values,
    );
  }
}
