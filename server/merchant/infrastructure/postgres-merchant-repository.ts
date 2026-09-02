import type { Pool } from "pg";
import type { MerchantRepository } from "@/server/merchant/application/ports/merchant-repository";
import type {
  DashboardSummary,
  FunnelPoint,
  MerchantIdentity,
  MerchantLocation,
  MerchantQrCode,
  TrendPoint,
} from "@/server/merchant/domain/merchant";

interface LoginRow extends MerchantIdentity { passwordHash: string }

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
      `UPDATE merchant_sessions SET last_seen_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL`,
      [tokenHash],
    );
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
         (SELECT COUNT(*)::int FROM qr_codes q JOIN locations l ON l.id = q.location_id WHERE l.organization_id = $1 AND q.is_active = TRUE) AS "qrCodes",
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
      `SELECT id, public_id AS "publicId", name, subtitle, google_place_id AS "googlePlaceId",
              google_review_url AS "googleReviewUrl", is_active AS "isActive", created_at AS "createdAt"
       FROM locations WHERE organization_id = $1 ORDER BY created_at DESC`,
      [organizationId],
    );
    return result.rows;
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
    const current = await this.pool.query<MerchantLocation>(
      `SELECT id, public_id AS "publicId", name, subtitle, google_place_id AS "googlePlaceId",
              google_review_url AS "googleReviewUrl", is_active AS "isActive", created_at AS "createdAt"
       FROM locations WHERE id=$1 AND organization_id=$2 LIMIT 1`,
      [locationId, organizationId],
    );
    const existing = current.rows[0];
    if (!existing) return null;
    const next = { ...existing, ...input };
    const result = await this.pool.query<MerchantLocation>(
      `UPDATE locations SET public_id=$3,name=$4,subtitle=$5,google_place_id=$6,google_review_url=$7,is_active=$8,updated_at=NOW()
       WHERE id=$1 AND organization_id=$2
       RETURNING id, public_id AS "publicId", name, subtitle, google_place_id AS "googlePlaceId",
                 google_review_url AS "googleReviewUrl", is_active AS "isActive", created_at AS "createdAt"`,
      [locationId, organizationId, next.publicId, next.name, next.subtitle, next.googlePlaceId, next.googleReviewUrl, next.isActive],
    );
    return result.rows[0] ?? null;
  }

  async listQrCodes(organizationId: string): Promise<MerchantQrCode[]> {
    const result = await this.pool.query<MerchantQrCode>(
      `SELECT q.id, q.location_id AS "locationId", l.name AS "locationName", q.public_token AS "publicToken",
              q.name, q.source_type AS "sourceType", q.reference, q.is_active AS "isActive", q.created_at AS "createdAt"
       FROM qr_codes q JOIN locations l ON l.id=q.location_id
       WHERE l.organization_id=$1 ORDER BY q.created_at DESC`,
      [organizationId],
    );
    return result.rows;
  }

  async createQrCode(organizationId: string, input: { locationId: string; publicToken: string; name: string; sourceType: string; reference?: string | null }): Promise<MerchantQrCode> {
    const result = await this.pool.query<MerchantQrCode>(
      `INSERT INTO qr_codes (location_id, public_token, name, source_type, reference)
       SELECT l.id,$3,$4,$5,$6 FROM locations l WHERE l.id=$1 AND l.organization_id=$2
       RETURNING id, location_id AS "locationId", ''::text AS "locationName", public_token AS "publicToken",
                 name, source_type AS "sourceType", reference, is_active AS "isActive", created_at AS "createdAt"`,
      [input.locationId, organizationId, input.publicToken, input.name, input.sourceType, input.reference ?? null],
    );
    if (!result.rows[0]) throw new Error("Location not found for organization.");
    const row = result.rows[0];
    const location = await this.pool.query<{ name: string }>(`SELECT name FROM locations WHERE id=$1`, [row.locationId]);
    return { ...row, locationName: location.rows[0]?.name ?? "" };
  }

  async updateQrCodeStatus(organizationId: string, qrCodeId: string, isActive: boolean): Promise<MerchantQrCode | null> {
    const result = await this.pool.query<MerchantQrCode>(
      `UPDATE qr_codes q SET is_active=$3,updated_at=NOW()
       FROM locations l
       WHERE q.id=$1 AND q.location_id=l.id AND l.organization_id=$2
       RETURNING q.id, q.location_id AS "locationId", l.name AS "locationName", q.public_token AS "publicToken",
                 q.name, q.source_type AS "sourceType", q.reference, q.is_active AS "isActive", q.created_at AS "createdAt"`,
      [qrCodeId, organizationId, isActive],
    );
    return result.rows[0] ?? null;
  }
}
