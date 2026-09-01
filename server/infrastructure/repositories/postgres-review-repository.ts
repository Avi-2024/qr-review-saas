import type { Pool, PoolClient } from "pg";
import type { ReviewRepository } from "@/server/application/ports/review-repository";
import type {
  CreateSessionInput,
  GenerationClaim,
  LocationConfig,
  QrCodeConfig,
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

interface QrRow {
  id: string;
  location_id: string;
  public_token: string;
  name: string;
  source_type: string;
  reference: string | null;
}

interface GenerationRow {
  status: "processing" | "completed";
  draft_id: string | null;
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

  async getQrByToken(publicToken: string): Promise<QrCodeConfig | null> {
    const result = await this.pool.query<QrRow>(
      `SELECT id, location_id, public_token, name, source_type, reference
       FROM qr_codes
       WHERE public_token = $1 AND is_active = TRUE
       LIMIT 1`,
      [publicToken],
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
      id: row.id,
      locationId: row.location_id,
      publicToken: row.public_token,
      name: row.name,
      sourceType: row.source_type,
      reference: row.reference,
    };
  }

  async createSession(input: CreateSessionInput) {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      const inserted = await client.query<ReviewSession>(
        `INSERT INTO review_sessions
           (location_id, qr_code_id, client_session_id, user_agent, ip_hash, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (qr_code_id, client_session_id) DO NOTHING
         RETURNING
           id,
           location_id AS "locationId",
           qr_code_id AS "qrCodeId",
           client_session_id AS "clientSessionId",
           started_at AS "startedAt",
           expires_at AS "expiresAt"`,
        [
          input.locationId,
          input.qrCodeId,
          input.clientSessionId,
          input.userAgent ?? null,
          input.ipHash ?? null,
          input.expiresAt,
        ],
      );

      if (inserted.rows[0]) {
        const session = inserted.rows[0];
        await client.query(
          `INSERT INTO review_events (session_id, event_type, metadata)
           VALUES ($1, 'QR_SCANNED', '{}'::jsonb)`,
          [session.id],
        );
        await client.query("COMMIT");
        return { session, created: true };
      }

      const existing = await client.query<ReviewSession>(
        `SELECT
           id,
           location_id AS "locationId",
           qr_code_id AS "qrCodeId",
           client_session_id AS "clientSessionId",
           started_at AS "startedAt",
           expires_at AS "expiresAt"
         FROM review_sessions
         WHERE qr_code_id = $1 AND client_session_id = $2
         LIMIT 1`,
        [input.qrCodeId, input.clientSessionId],
      );

      await client.query("COMMIT");
      return { session: existing.rows[0], created: false };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getSession(id: string) {
    const result = await this.pool.query<ReviewSession>(
      `SELECT
         id,
         location_id AS "locationId",
         qr_code_id AS "qrCodeId",
         client_session_id AS "clientSessionId",
         started_at AS "startedAt",
         expires_at AS "expiresAt"
       FROM review_sessions
       WHERE id = $1
       LIMIT 1`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async claimGeneration(sessionId: string, requestId: string): Promise<GenerationClaim> {
    const inserted = await this.pool.query<{ request_id: string }>(
      `INSERT INTO review_generation_requests (session_id, request_id, status)
       VALUES ($1, $2, 'processing')
       ON CONFLICT (session_id, request_id) DO NOTHING
       RETURNING request_id`,
      [sessionId, requestId],
    );

    if (inserted.rows[0]) return { status: "claimed" };

    const existing = await this.pool.query<GenerationRow>(
      `SELECT status, draft_id
       FROM review_generation_requests
       WHERE session_id = $1 AND request_id = $2
       LIMIT 1`,
      [sessionId, requestId],
    );

    const row = existing.rows[0];
    if (row?.status === "completed" && row.draft_id) {
      return { status: "completed", draftId: row.draft_id };
    }

    return { status: "in_progress" };
  }

  async releaseGenerationClaim(sessionId: string, requestId: string) {
    await this.pool.query(
      `DELETE FROM review_generation_requests
       WHERE session_id = $1 AND request_id = $2 AND status = 'processing'`,
      [sessionId, requestId],
    );
  }

  async saveGeneratedDraft(input: SaveDraftInput) {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      const result = await client.query<ReviewDraft>(
        `INSERT INTO review_drafts
           (session_id, request_id, rating, note, draft_text, generation_provider, variation)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING
           id,
           session_id AS "sessionId",
           request_id AS "requestId",
           rating,
           note,
           draft_text AS text,
           generation_provider AS provider,
           variation,
           created_at AS "createdAt"`,
        [
          input.sessionId,
          input.requestId,
          input.rating,
          input.note?.trim() || null,
          input.text,
          input.provider,
          input.variation,
        ],
      );

      const draft = result.rows[0];
      await this.insertDraftTopics(client, draft.id, input.sessionId, input.topicIds);
      await client.query(
        `INSERT INTO review_events (session_id, review_draft_id, event_type, metadata)
         VALUES ($1, $2, $3, $4::jsonb)`,
        [input.sessionId, draft.id, input.eventType, JSON.stringify({ provider: input.provider })],
      );
      await client.query(
        `UPDATE review_generation_requests
         SET status = 'completed', draft_id = $3, updated_at = NOW()
         WHERE session_id = $1 AND request_id = $2`,
        [input.sessionId, input.requestId, draft.id],
      );

      await client.query("COMMIT");
      return { ...draft, topicIds: [...input.topicIds] };
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
         request_id AS "requestId",
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
      `INSERT INTO review_events
         (session_id, review_draft_id, client_event_id, event_type, metadata)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       ON CONFLICT (client_event_id) WHERE client_event_id IS NOT NULL DO NOTHING`,
      [
        input.sessionId,
        input.draftId ?? null,
        input.clientEventId ?? null,
        input.type,
        JSON.stringify(input.metadata ?? {}),
      ],
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

  private async insertDraftTopics(
    client: PoolClient,
    draftId: string,
    sessionId: string,
    topicIds: string[],
  ) {
    if (!topicIds.length) return;

    await client.query(
      `INSERT INTO review_draft_topics (draft_id, location_id, topic_id)
       SELECT $1, s.location_id, topic_id
       FROM review_sessions s
       CROSS JOIN UNNEST($3::text[]) AS selected(topic_id)
       WHERE s.id = $2`,
      [draftId, sessionId, topicIds],
    );
  }
}
