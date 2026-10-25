import type { Pool, PoolClient } from "pg";
import type { MerchantRepository } from "@/server/merchant/application/ports/merchant-repository";
import type {
  DashboardSummary,
  FunnelPoint,
  MerchantIdentity,
  MerchantLocation,
  MerchantOrganizationProfile,
  MerchantQrCode,
  MerchantTopicConfig,
  StandeeItem,
  TrendPoint,
} from "@/server/merchant/domain/merchant";

interface LoginRow extends MerchantIdentity { passwordHash: string }

const ORGANIZATION_SELECT = `
  SELECT id, name, business_type AS "businessType", onboarding_stage AS "onboardingStage",
         onboarding_completed_at AS "onboardingCompletedAt"
  FROM organizations`;

const LOCATION_SELECT = `
  SELECT id, public_id AS "publicId", name, subtitle, google_place_id AS "googlePlaceId",
         google_review_url AS "googleReviewUrl", is_active AS "isActive", created_at AS "createdAt"
  FROM locations`;

const QR_SELECT = `
  SELECT q.id, q.location_id AS "locationId", l.name AS "locationName", q.public_token AS "publicToken",
         q.name, q.source_type AS "sourceType", q.reference, q.is_active AS "isActive", q.created_at AS "createdAt"
  FROM qr_codes q
  JOIN locations l ON l.id = q.location_id`;

const TOPIC_SELECT = `
  SELECT id, label, icon, sort_order AS "sortOrder", is_active AS "isActive"
  FROM review_topics`;

const STANDEE_SELECT = `
  SELECT s.id, s.organization_id AS "organizationId", s.standee_code AS "standeeCode",
         s.public_token AS "publicToken", s.batch_name AS "batchName", s.location_id AS "locationId",
         COALESCE(l.name, '') AS "locationName", s.qr_code_id AS "qrCodeId", s.status,
         s.assigned_at AS "assignedAt", s.notes, s.created_at AS "createdAt", s.updated_at AS "updatedAt"
  FROM standee_inventory s
  LEFT JOIN locations l ON l.id = s.location_id`;

async function rollbackQuietly(client: PoolClient) {
  await client.query("ROLLBACK").catch(() => undefined);
}

export class PostgresMerchantRepository implements MerchantRepository {
  constructor(private readonly pool: Pool) {}

  async findUserForLogin(email: string): Promise<LoginRow | null> {
    const result = await this.pool.query<LoginRow>(
      `SELECT
         u.id AS "userId",
         u.email,
         u.name,
         u.password_hash AS "passwordHash",
         o.id AS "organizationId",
         o.name AS "organizationName",
         o.business_type AS "businessType",
         o.onboarding_stage AS "onboardingStage",
         o.onboarding_completed_at AS "onboardingCompletedAt",
         m.role
       FROM merchant_users u
       JOIN organization_memberships m ON m.user_id = u.id
       JOIN organizations o ON o.id = m.organization_id
       WHERE LOWER(u.email) = LOWER($1) AND u.is_active = TRUE
       ORDER BY CASE m.role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 WHEN 'manager' THEN 3 ELSE 4 END,
                m.created_at ASC
       LIMIT 1`,
      [email],
    );
    return result.rows[0] ?? null;
  }

  async createSession(input: { userId: string; organizationId: string; tokenHash: string; userAgent?: string; ipHash?: string; expiresAt: Date }) {
    await this.pool.query(
      `INSERT INTO merchant_sessions
        (user_id, organization_id, token_hash, user_agent, ip_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [input.userId, input.organizationId, input.tokenHash, input.userAgent ?? null, input.ipHash ?? null, input.expiresAt],
    );
  }

  async getIdentityBySessionTokenHash(tokenHash: string): Promise<MerchantIdentity | null> {
    const result = await this.pool.query<MerchantIdentity>(
      `SELECT
         u.id AS "userId",
         u.email,
         u.name,
         o.id AS "organizationId",
         o.name AS "organizationName",
         o.business_type AS "businessType",
         o.onboarding_stage AS "onboardingStage",
         o.onboarding_completed_at AS "onboardingCompletedAt",
         m.role
       FROM merchant_sessions s
       JOIN merchant_users u ON u.id = s.user_id AND u.is_active = TRUE
       JOIN organizations o ON o.id = s.organization_id
       JOIN organization_memberships m ON m.user_id = u.id AND m.organization_id = o.id
       WHERE s.token_hash = $1
         AND s.revoked_at IS NULL
         AND s.expires_at > NOW()
       LIMIT 1`,
      [tokenHash],
    );
    return result.rows[0] ?? null;
  }

  async revokeSession(tokenHash: string) {
    await this.pool.query(
      `UPDATE merchant_sessions SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL`,
      [tokenHash],
    );
  }

  async touchSession(tokenHash: string) {
    await this.pool.query(
      `UPDATE merchant_sessions
       SET last_seen_at = NOW()
       WHERE token_hash = $1
         AND revoked_at IS NULL
         AND last_seen_at < NOW() - INTERVAL '5 minutes'`,
      [tokenHash],
    );
  }

  async getOrganizationProfile(organizationId: string): Promise<MerchantOrganizationProfile | null> {
    const result = await this.pool.query<MerchantOrganizationProfile>(
      `${ORGANIZATION_SELECT} WHERE id=$1 LIMIT 1`,
      [organizationId],
    );
    return result.rows[0] ?? null;
  }

  async saveOnboardingBusiness(organizationId: string, input: { name: string; businessType: string }): Promise<MerchantOrganizationProfile | null> {
    const result = await this.pool.query<MerchantOrganizationProfile>(
      `UPDATE organizations
       SET name=$2,
           business_type=$3,
           onboarding_stage=CASE WHEN onboarding_stage='business' THEN 'location' ELSE onboarding_stage END,
           updated_at=NOW()
       WHERE id=$1 AND onboarding_completed_at IS NULL
       RETURNING id, name, business_type AS "businessType", onboarding_stage AS "onboardingStage",
                 onboarding_completed_at AS "onboardingCompletedAt"`,
      [organizationId, input.name, input.businessType],
    );
    return result.rows[0] ?? null;
  }

  async createOnboardingLocation(organizationId: string, input: Omit<MerchantLocation, "id" | "createdAt">): Promise<MerchantLocation | null> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const state = await client.query<{ onboardingStage: string }>(
        `SELECT onboarding_stage AS "onboardingStage"
         FROM organizations
         WHERE id=$1 AND onboarding_completed_at IS NULL
         FOR UPDATE`,
        [organizationId],
      );
      if (state.rows[0]?.onboardingStage !== "location") {
        await rollbackQuietly(client);
        return null;
      }

      const result = await client.query<MerchantLocation>(
        `INSERT INTO locations (organization_id, public_id, name, subtitle, google_place_id, google_review_url, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING id, public_id AS "publicId", name, subtitle, google_place_id AS "googlePlaceId",
                   google_review_url AS "googleReviewUrl", is_active AS "isActive", created_at AS "createdAt"`,
        [organizationId, input.publicId, input.name, input.subtitle, input.googlePlaceId, input.googleReviewUrl, input.isActive],
      );

      await client.query(
        `UPDATE organizations SET onboarding_stage='topics',updated_at=NOW() WHERE id=$1`,
        [organizationId],
      );
      await client.query("COMMIT");
      return result.rows[0] ?? null;
    } catch (error) {
      await rollbackQuietly(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async listLocationTopics(organizationId: string, locationId: string): Promise<MerchantTopicConfig[]> {
    const result = await this.pool.query<MerchantTopicConfig>(
      `${TOPIC_SELECT}
       WHERE location_id=$2
         AND EXISTS (SELECT 1 FROM locations l WHERE l.id=$2 AND l.organization_id=$1)
       ORDER BY sort_order,id`,
      [organizationId, locationId],
    );
    return result.rows;
  }

  async replaceOnboardingTopics(organizationId: string, locationId: string, topics: Array<{ label: string; icon: string }>): Promise<MerchantTopicConfig[] | null> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const state = await client.query<{ onboardingStage: string }>(
        `SELECT onboarding_stage AS "onboardingStage"
         FROM organizations
         WHERE id=$1 AND onboarding_completed_at IS NULL
         FOR UPDATE`,
        [organizationId],
      );
      if (state.rows[0]?.onboardingStage !== "topics") {
        await rollbackQuietly(client);
        return null;
      }

      const location = await client.query<{ id: string }>(
        `SELECT id FROM locations WHERE id=$1 AND organization_id=$2 AND is_active=TRUE LIMIT 1 FOR UPDATE`,
        [locationId, organizationId],
      );
      if (!location.rows[0]) {
        await rollbackQuietly(client);
        return null;
      }

      const qrCount = await client.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM qr_codes WHERE location_id=$1`,
        [locationId],
      );
      if ((qrCount.rows[0]?.count ?? 0) > 0) {
        await rollbackQuietly(client);
        return null;
      }

      await client.query(`DELETE FROM review_topics WHERE location_id=$1`, [locationId]);
      for (const [index, topic] of topics.entries()) {
        await client.query(
          `INSERT INTO review_topics(id,location_id,label,icon,sort_order,is_active)
           VALUES ($1,$2,$3,$4,$5,TRUE)`,
          [`topic-${index + 1}`, locationId, topic.label, topic.icon, (index + 1) * 10],
        );
      }

      await client.query(`UPDATE organizations SET onboarding_stage='qr',updated_at=NOW() WHERE id=$1`, [organizationId]);
      const result = await client.query<MerchantTopicConfig>(
        `${TOPIC_SELECT} WHERE location_id=$1 ORDER BY sort_order,id`,
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

  async createOnboardingQrCode(organizationId: string, input: { locationId: string; publicToken: string; name: string; sourceType: string; reference?: string | null }): Promise<MerchantQrCode | null> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const state = await client.query<{ onboardingStage: string }>(
        `SELECT onboarding_stage AS "onboardingStage"
         FROM organizations
         WHERE id=$1 AND onboarding_completed_at IS NULL
         FOR UPDATE`,
        [organizationId],
      );
      if (state.rows[0]?.onboardingStage !== "qr") {
        await rollbackQuietly(client);
        return null;
      }

      const result = await client.query<MerchantQrCode>(
        `INSERT INTO qr_codes (location_id, public_token, name, source_type, reference)
         SELECT l.id,$3,$4,$5,$6
         FROM locations l
         WHERE l.id=$1 AND l.organization_id=$2 AND l.is_active=TRUE
         RETURNING id, location_id AS "locationId", ''::text AS "locationName", public_token AS "publicToken",
                   name, source_type AS "sourceType", reference, is_active AS "isActive", created_at AS "createdAt"`,
        [input.locationId, organizationId, input.publicToken, input.name, input.sourceType, input.reference ?? null],
      );
      if (!result.rows[0]) {
        await rollbackQuietly(client);
        return null;
      }

      const location = await client.query<{ name: string }>(`SELECT name FROM locations WHERE id=$1`, [input.locationId]);
      await client.query(`UPDATE organizations SET onboarding_stage='ready',updated_at=NOW() WHERE id=$1`, [organizationId]);
      await client.query("COMMIT");
      return { ...result.rows[0], locationName: location.rows[0]?.name ?? "" };
    } catch (error) {
      await rollbackQuietly(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async completeOnboarding(organizationId: string): Promise<MerchantOrganizationProfile | null> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const state = await client.query<{ onboardingStage: string; onboardingCompletedAt: Date | null }>(
        `SELECT onboarding_stage AS "onboardingStage", onboarding_completed_at AS "onboardingCompletedAt"
         FROM organizations WHERE id=$1 FOR UPDATE`,
        [organizationId],
      );
      if (!state.rows[0]) {
        await rollbackQuietly(client);
        return null;
      }
      if (state.rows[0].onboardingStage === "complete" && state.rows[0].onboardingCompletedAt) {
        await client.query("COMMIT");
        return this.getOrganizationProfile(organizationId);
      }
      if (state.rows[0].onboardingStage !== "ready") {
        await rollbackQuietly(client);
        return null;
      }

      const prerequisites = await client.query<{ ready: boolean }>(
        `SELECT EXISTS(
           SELECT 1 FROM locations l WHERE l.organization_id=$1 AND l.is_active=TRUE
         ) AND EXISTS(
           SELECT 1 FROM qr_codes q JOIN locations l ON l.id=q.location_id
           WHERE l.organization_id=$1 AND l.is_active=TRUE AND q.is_active=TRUE
         ) AS ready`,
        [organizationId],
      );
      if (!prerequisites.rows[0]?.ready) {
        await rollbackQuietly(client);
        return null;
      }

      const result = await client.query<MerchantOrganizationProfile>(
        `UPDATE organizations
         SET onboarding_stage='complete',onboarding_completed_at=NOW(),updated_at=NOW()
         WHERE id=$1
         RETURNING id,name,business_type AS "businessType",onboarding_stage AS "onboardingStage",
                   onboarding_completed_at AS "onboardingCompletedAt"`,
        [organizationId],
      );
      await client.query("COMMIT");
      return result.rows[0] ?? null;
    } catch (error) {
      await rollbackQuietly(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async getDashboardSummary(organizationId: string, days: number): Promise<DashboardSummary> {
    const result = await this.pool.query<DashboardSummary & { conversionRate: number }>(
      `WITH org_locations AS (
         SELECT id FROM locations WHERE organization_id = $1
       ), org_sessions AS (
         SELECT s.id
         FROM review_sessions s
         JOIN org_locations l ON l.id = s.location_id
         WHERE s.started_at >= NOW() - ($2::int * INTERVAL '1 day')
       ), metrics AS (
         SELECT
           COUNT(DISTINCT CASE WHEN e.event_type = 'QR_SCANNED' THEN e.session_id END)::int AS scans,
           COUNT(DISTINCT CASE WHEN e.event_type IN ('REVIEW_GENERATED','REVIEW_REGENERATED') THEN e.session_id END)::int AS "reviewsGenerated",
           COUNT(DISTINCT CASE WHEN e.event_type = 'GOOGLE_REVIEW_OPENED' THEN e.session_id END)::int AS "googleOpens"
         FROM review_events e
         JOIN org_sessions s ON s.id = e.session_id
       )
       SELECT
         (SELECT COUNT(*)::int FROM locations WHERE organization_id = $1 AND is_active = TRUE) AS locations,
         (SELECT COUNT(*)::int
            FROM qr_codes q
            JOIN locations l ON l.id = q.location_id
           WHERE l.organization_id = $1
             AND l.is_active = TRUE
             AND q.is_active = TRUE) AS "qrCodes",
         metrics.scans,
         metrics."reviewsGenerated",
         metrics."googleOpens",
         CASE WHEN metrics.scans = 0 THEN 0 ELSE ROUND((metrics."googleOpens"::numeric / metrics.scans::numeric) * 100, 1)::float END AS "conversionRate"
       FROM metrics`,
      [organizationId, days],
    );
    return result.rows[0] ?? { locations: 0, qrCodes: 0, scans: 0, reviewsGenerated: 0, googleOpens: 0, conversionRate: 0 };
  }

  async getFunnel(organizationId: string, days: number): Promise<FunnelPoint[]> {
    const result = await this.pool.query<{ event: string; value: number }>(
      `WITH org_sessions AS (
         SELECT s.id
         FROM review_sessions s
         JOIN locations l ON l.id = s.location_id
         WHERE l.organization_id = $1
           AND s.started_at >= NOW() - ($2::int * INTERVAL '1 day')
       )
       SELECT event, value::int
       FROM (
         VALUES
           ('QR_SCANNED', (SELECT COUNT(DISTINCT e.session_id) FROM review_events e JOIN org_sessions s ON s.id=e.session_id WHERE e.event_type='QR_SCANNED')),
           ('RATING_SELECTED', (SELECT COUNT(DISTINCT e.session_id) FROM review_events e JOIN org_sessions s ON s.id=e.session_id WHERE e.event_type='RATING_SELECTED')),
           ('GENERATE_CLICKED', (SELECT COUNT(DISTINCT e.session_id) FROM review_events e JOIN org_sessions s ON s.id=e.session_id WHERE e.event_type='GENERATE_CLICKED')),
           ('REVIEW_GENERATED', (SELECT COUNT(DISTINCT e.session_id) FROM review_events e JOIN org_sessions s ON s.id=e.session_id WHERE e.event_type IN ('REVIEW_GENERATED','REVIEW_REGENERATED'))),
           ('GOOGLE_REVIEW_OPENED', (SELECT COUNT(DISTINCT e.session_id) FROM review_events e JOIN org_sessions s ON s.id=e.session_id WHERE e.event_type='GOOGLE_REVIEW_OPENED'))
       ) AS funnel(event, value)`,
      [organizationId, days],
    );
    return result.rows;
  }

  async getTrend(organizationId: string, days: number): Promise<TrendPoint[]> {
    const result = await this.pool.query<TrendPoint>(
      `WITH dates AS (
         SELECT generate_series(CURRENT_DATE - ($2::int - 1), CURRENT_DATE, INTERVAL '1 day')::date AS day
       ), events AS (
         SELECT e.created_at::date AS day, e.event_type, e.session_id
         FROM review_events e
         JOIN review_sessions s ON s.id = e.session_id
         JOIN locations l ON l.id = s.location_id
         WHERE l.organization_id = $1
           AND e.created_at >= CURRENT_DATE - ($2::int - 1)
       )
       SELECT
         TO_CHAR(d.day, 'YYYY-MM-DD') AS date,
         COUNT(DISTINCT CASE WHEN e.event_type='QR_SCANNED' THEN e.session_id END)::int AS scans,
         COUNT(DISTINCT CASE WHEN e.event_type IN ('REVIEW_GENERATED','REVIEW_REGENERATED') THEN e.session_id END)::int AS generated,
         COUNT(DISTINCT CASE WHEN e.event_type='GOOGLE_REVIEW_OPENED' THEN e.session_id END)::int AS "googleOpens"
       FROM dates d
       LEFT JOIN events e ON e.day = d.day
       GROUP BY d.day
       ORDER BY d.day ASC`,
      [organizationId, days],
    );
    return result.rows;
  }

  async listLocations(organizationId: string): Promise<MerchantLocation[]> {
    const result = await this.pool.query<MerchantLocation>(
      `${LOCATION_SELECT} WHERE organization_id = $1 ORDER BY created_at DESC`,
      [organizationId],
    );
    return result.rows;
  }

  async getLocation(organizationId: string, locationId: string): Promise<MerchantLocation | null> {
    const result = await this.pool.query<MerchantLocation>(
      `${LOCATION_SELECT} WHERE organization_id = $1 AND id = $2 LIMIT 1`,
      [organizationId, locationId],
    );
    return result.rows[0] ?? null;
  }

  async isLocationPublicIdAvailable(publicId: string) {
    const result = await this.pool.query<{ available: boolean }>(
      `SELECT NOT EXISTS(SELECT 1 FROM locations WHERE public_id = $1) AS available`,
      [publicId],
    );
    return Boolean(result.rows[0]?.available);
  }

  async createLocation(organizationId: string, input: Omit<MerchantLocation, "id" | "createdAt">): Promise<MerchantLocation> {
    const result = await this.pool.query<MerchantLocation>(
      `INSERT INTO locations (organization_id, public_id, name, subtitle, google_place_id, google_review_url, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, public_id AS "publicId", name, subtitle, google_place_id AS "googlePlaceId",
                 google_review_url AS "googleReviewUrl", is_active AS "isActive", created_at AS "createdAt"`,
      [organizationId, input.publicId, input.name, input.subtitle, input.googlePlaceId, input.googleReviewUrl, input.isActive],
    );
    return result.rows[0];
  }

  async updateLocation(organizationId: string, locationId: string, input: Partial<Omit<MerchantLocation, "id" | "createdAt">>): Promise<MerchantLocation | null> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const current = await client.query<MerchantLocation>(
        `${LOCATION_SELECT} WHERE id=$1 AND organization_id=$2 LIMIT 1 FOR UPDATE`,
        [locationId, organizationId],
      );
      const existing = current.rows[0];
      if (!existing) {
        await rollbackQuietly(client);
        return null;
      }

      const next = { ...existing, ...input };
      const result = await client.query<MerchantLocation>(
        `UPDATE locations SET public_id=$3,name=$4,subtitle=$5,google_place_id=$6,google_review_url=$7,is_active=$8,updated_at=NOW()
         WHERE id=$1 AND organization_id=$2
         RETURNING id, public_id AS "publicId", name, subtitle, google_place_id AS "googlePlaceId",
                   google_review_url AS "googleReviewUrl", is_active AS "isActive", created_at AS "createdAt"`,
        [locationId, organizationId, next.publicId, next.name, next.subtitle, next.googlePlaceId, next.googleReviewUrl, next.isActive],
      );

      if (existing.isActive && next.isActive === false) {
        await client.query(
          `UPDATE qr_codes SET is_active = FALSE, updated_at = NOW() WHERE location_id = $1 AND is_active = TRUE`,
          [locationId],
        );
      }

      await client.query("COMMIT");
      return result.rows[0] ?? null;
    } catch (error) {
      await rollbackQuietly(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async listQrCodes(organizationId: string): Promise<MerchantQrCode[]> {
    const result = await this.pool.query<MerchantQrCode>(
      `${QR_SELECT} WHERE l.organization_id=$1 ORDER BY q.created_at DESC`,
      [organizationId],
    );
    return result.rows;
  }

  async getQrCode(organizationId: string, qrCodeId: string): Promise<MerchantQrCode | null> {
    const result = await this.pool.query<MerchantQrCode>(
      `${QR_SELECT} WHERE l.organization_id=$1 AND q.id=$2 LIMIT 1`,
      [organizationId, qrCodeId],
    );
    return result.rows[0] ?? null;
  }

  async createQrCode(organizationId: string, input: { locationId: string; publicToken: string; name: string; sourceType: string; reference?: string | null }): Promise<MerchantQrCode> {
    const result = await this.pool.query<MerchantQrCode>(
      `INSERT INTO qr_codes (location_id, public_token, name, source_type, reference)
       SELECT l.id,$3,$4,$5,$6
       FROM locations l
       WHERE l.id=$1 AND l.organization_id=$2 AND l.is_active=TRUE
       RETURNING id, location_id AS "locationId", ''::text AS "locationName", public_token AS "publicToken",
                 name, source_type AS "sourceType", reference, is_active AS "isActive", created_at AS "createdAt"`,
      [input.locationId, organizationId, input.publicToken, input.name, input.sourceType, input.reference ?? null],
    );
    if (!result.rows[0]) return Promise.reject(new Error("Active location not found for organization."));
    const row = result.rows[0];
    const location = await this.pool.query<{ name: string }>(`SELECT name FROM locations WHERE id=$1`, [row.locationId]);
    return { ...row, locationName: location.rows[0]?.name ?? "" };
  }

  async updateQrCodeStatus(organizationId: string, qrCodeId: string, isActive: boolean): Promise<MerchantQrCode | null> {
    const result = await this.pool.query<MerchantQrCode>(
      `UPDATE qr_codes q SET is_active=$3,updated_at=NOW()
       FROM locations l
       WHERE q.id=$1
         AND q.location_id=l.id
         AND l.organization_id=$2
         AND ($3 = FALSE OR l.is_active = TRUE)
       RETURNING q.id, q.location_id AS "locationId", l.name AS "locationName", q.public_token AS "publicToken",
                 q.name, q.source_type AS "sourceType", q.reference, q.is_active AS "isActive", q.created_at AS "createdAt"`,
      [qrCodeId, organizationId, isActive],
    );
    return result.rows[0] ?? null;
  }

  async listStandees(organizationId: string): Promise<StandeeItem[]> {
    const result = await this.pool.query<StandeeItem>(
      `${STANDEE_SELECT} WHERE s.organization_id = $1 ORDER BY s.created_at DESC, s.standee_code ASC`,
      [organizationId],
    );
    return result.rows;
  }

  async getStandeeByToken(publicToken: string): Promise<StandeeItem | null> {
    const result = await this.pool.query<StandeeItem>(
      `${STANDEE_SELECT} WHERE LOWER(s.public_token) = LOWER($1) LIMIT 1`,
      [publicToken.trim()],
    );
    return result.rows[0] ?? null;
  }

  async createStandeeBatch(
    organizationId: string,
    input: { count: number; prefix?: string; batchName?: string },
  ): Promise<StandeeItem[]> {
    const count = Math.min(250, Math.max(1, input.count));
    const prefix = (input.prefix || "ST-").trim().toUpperCase();
    const batchName = (input.batchName || "Retail Batch").trim();

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      // Find highest existing numerical suffix for this prefix
      let nextIndex = 1;
      const allPrefix = await client.query<{ standee_code: string }>(
        `SELECT standee_code FROM standee_inventory WHERE organization_id = $1 AND standee_code LIKE $2`,
        [organizationId, `${prefix}%`],
      );
      for (const row of allPrefix.rows) {
        const numPart = parseInt(row.standee_code.replace(prefix, ""), 10);
        if (!isNaN(numPart) && numPart >= nextIndex) {
          nextIndex = numPart + 1;
        }
      }

      const created: StandeeItem[] = [];
      for (let i = 0; i < count; i += 1) {
        const currentNum = nextIndex + i;
        const standeeCode = `${prefix}${String(currentNum).padStart(3, "0")}`;
        const publicToken = standeeCode.toLowerCase();

        const inserted = await client.query<StandeeItem>(
          `INSERT INTO standee_inventory (organization_id, standee_code, public_token, batch_name, status)
           VALUES ($1, $2, $3, $4, 'unassigned')
           ON CONFLICT (public_token) DO UPDATE SET updated_at = NOW()
           RETURNING id, organization_id AS "organizationId", standee_code AS "standeeCode",
                     public_token AS "publicToken", batch_name AS "batchName", location_id AS "locationId",
                     ''::text AS "locationName", qr_code_id AS "qrCodeId", status, assigned_at AS "assignedAt",
                     notes, created_at AS "createdAt", updated_at AS "updatedAt"`,
          [organizationId, standeeCode, publicToken, batchName],
        );
        if (inserted.rows[0]) created.push(inserted.rows[0]);
      }

      await client.query("COMMIT");
      return created;
    } catch (err) {
      await rollbackQuietly(client);
      throw err;
    } finally {
      client.release();
    }
  }

  async assignStandee(
    organizationId: string,
    input: { standeeId?: string; standeeCode?: string; locationId: string; notes?: string },
  ): Promise<StandeeItem> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      // Verify location
      const locRes = await client.query<{ id: string; name: string; is_active: boolean }>(
        `SELECT id, name, is_active FROM locations WHERE id = $1 AND organization_id = $2`,
        [input.locationId, organizationId],
      );
      const location = locRes.rows[0];
      if (!location) throw new Error("Location not found.");
      if (!location.is_active) throw new Error("Location is paused/inactive. Please activate it first.");

      // Find standee
      let standeeRes;
      if (input.standeeId) {
        standeeRes = await client.query<{ id: string; standee_code: string; public_token: string }>(
          `SELECT id, standee_code, public_token FROM standee_inventory WHERE id = $1 AND organization_id = $2 FOR UPDATE`,
          [input.standeeId, organizationId],
        );
      } else if (input.standeeCode) {
        standeeRes = await client.query<{ id: string; standee_code: string; public_token: string }>(
          `SELECT id, standee_code, public_token FROM standee_inventory WHERE LOWER(standee_code) = LOWER($1) AND organization_id = $2 FOR UPDATE`,
          [input.standeeCode.trim(), organizationId],
        );
      } else {
        throw new Error("Either standeeId or standeeCode must be provided.");
      }

      const standee = standeeRes.rows[0];
      if (!standee) throw new Error("Standee not found in inventory.");

      // Create or activate qr_codes entry
      const qrRes = await client.query<{ id: string }>(
        `INSERT INTO qr_codes (location_id, public_token, name, source_type, reference, is_active)
         VALUES ($1, $2, $3, 'standee', $4, TRUE)
         ON CONFLICT (public_token) DO UPDATE
           SET location_id = EXCLUDED.location_id,
               name = EXCLUDED.name,
               is_active = TRUE,
               updated_at = NOW()
         RETURNING id`,
        [location.id, standee.public_token, `Counter Standee ${standee.standee_code}`, standee.standee_code],
      );
      const qrId = qrRes.rows[0].id;

      // Update standee_inventory
      const updated = await client.query<StandeeItem>(
        `UPDATE standee_inventory
         SET location_id = $1,
             qr_code_id = $2,
             status = 'assigned',
             assigned_at = NOW(),
             notes = COALESCE($3, notes),
             updated_at = NOW()
         WHERE id = $4
         RETURNING id, organization_id AS "organizationId", standee_code AS "standeeCode",
                   public_token AS "publicToken", batch_name AS "batchName", location_id AS "locationId",
                   $5::text AS "locationName", qr_code_id AS "qrCodeId", status, assigned_at AS "assignedAt",
                   notes, created_at AS "createdAt", updated_at AS "updatedAt"`,
        [location.id, qrId, input.notes ?? null, standee.id, location.name],
      );

      await client.query("COMMIT");
      return updated.rows[0];
    } catch (err) {
      await rollbackQuietly(client);
      throw err;
    } finally {
      client.release();
    }
  }

  async unbindStandee(organizationId: string, standeeId: string): Promise<StandeeItem> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const existing = await client.query<{ id: string; qr_code_id: string | null }>(
        `SELECT id, qr_code_id FROM standee_inventory WHERE id = $1 AND organization_id = $2 FOR UPDATE`,
        [standeeId, organizationId],
      );
      const item = existing.rows[0];
      if (!item) throw new Error("Standee not found.");

      if (item.qr_code_id) {
        await client.query(`UPDATE qr_codes SET is_active = FALSE WHERE id = $1`, [item.qr_code_id]);
      }

      const updated = await client.query<StandeeItem>(
        `UPDATE standee_inventory
         SET location_id = NULL,
             qr_code_id = NULL,
             status = 'unassigned',
             assigned_at = NULL,
             updated_at = NOW()
         WHERE id = $1
         RETURNING id, organization_id AS "organizationId", standee_code AS "standeeCode",
                   public_token AS "publicToken", batch_name AS "batchName", location_id AS "locationId",
                   NULL::text AS "locationName", qr_code_id AS "qrCodeId", status, assigned_at AS "assignedAt",
                   notes, created_at AS "createdAt", updated_at AS "updatedAt"`,
        [standeeId],
      );

      await client.query("COMMIT");
      return updated.rows[0];
    } catch (err) {
      await rollbackQuietly(client);
      throw err;
    } finally {
      client.release();
    }
  }
}
