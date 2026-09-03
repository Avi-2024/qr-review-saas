import type { Pool } from "pg";
import type { QrPerformanceRepository } from "@/server/analytics/application/ports/qr-performance-repository";
import type { QrAttributionSummary, QrPerformanceRow } from "@/server/analytics/domain/qr-performance";

export class PostgresQrPerformanceRepository implements QrPerformanceRepository {
  constructor(private readonly pool: Pool) {}

  async listQrPerformance(input: { organizationId: string; days: number; locationId?: string | null }): Promise<QrPerformanceRow[]> {
    const result = await this.pool.query<QrPerformanceRow>(
      `WITH scoped_qr AS (
         SELECT q.id, q.location_id, q.name, q.source_type, q.reference, q.is_active, l.name AS location_name
         FROM qr_codes q
         JOIN locations l ON l.id = q.location_id
         WHERE l.organization_id = $1
           AND ($3::uuid IS NULL OR l.id = $3::uuid)
       ), cohort_sessions AS (
         SELECT s.id, s.qr_code_id
         FROM review_sessions s
         JOIN scoped_qr q ON q.id = s.qr_code_id
         WHERE s.started_at >= NOW() - ($2::int * INTERVAL '1 day')
       ), metrics AS (
         SELECT
           s.qr_code_id,
           COUNT(DISTINCT CASE WHEN e.event_type = 'QR_SCANNED' THEN e.session_id END)::int AS scans,
           COUNT(DISTINCT CASE WHEN e.event_type IN ('REVIEW_GENERATED','REVIEW_REGENERATED') THEN e.session_id END)::int AS generated,
           COUNT(DISTINCT CASE WHEN e.event_type = 'GOOGLE_REVIEW_OPENED' THEN e.session_id END)::int AS google_opens
         FROM cohort_sessions s
         LEFT JOIN review_events e ON e.session_id = s.id
         GROUP BY s.qr_code_id
       )
       SELECT
         q.id AS "qrCodeId",
         q.location_id AS "locationId",
         q.location_name AS "locationName",
         q.name AS "qrName",
         q.source_type AS "sourceType",
         q.reference,
         q.is_active AS "isActive",
         COALESCE(m.scans, 0)::int AS scans,
         COALESCE(m.generated, 0)::int AS "reviewsGenerated",
         COALESCE(m.google_opens, 0)::int AS "googleOpens",
         CASE WHEN COALESCE(m.scans,0)=0 THEN 0 ELSE ROUND((m.generated::numeric / m.scans::numeric) * 100, 1)::float END AS "generationRate",
         CASE WHEN COALESCE(m.scans,0)=0 THEN 0 ELSE ROUND((m.google_opens::numeric / m.scans::numeric) * 100, 1)::float END AS "conversionRate",
         CASE WHEN COALESCE(m.generated,0)=0 THEN 0 ELSE ROUND((m.google_opens::numeric / m.generated::numeric) * 100, 1)::float END AS "googleFromGeneratedRate"
       FROM scoped_qr q
       LEFT JOIN metrics m ON m.qr_code_id = q.id
       ORDER BY COALESCE(m.scans,0) DESC, COALESCE(m.google_opens,0) DESC, q.location_name, q.name`,
      [input.organizationId, input.days, input.locationId ?? null],
    );
    return result.rows;
  }

  async getAttributionSummary(input: { organizationId: string; days: number }): Promise<QrAttributionSummary> {
    const result = await this.pool.query<QrAttributionSummary>(
      `WITH cohort_sessions AS (
         SELECT s.id, s.qr_code_id
         FROM review_sessions s
         JOIN locations l ON l.id = s.location_id
         WHERE l.organization_id = $1
           AND s.started_at >= NOW() - ($2::int * INTERVAL '1 day')
       ), scanned AS (
         SELECT DISTINCT s.id, s.qr_code_id
         FROM cohort_sessions s
         JOIN review_events e ON e.session_id = s.id AND e.event_type = 'QR_SCANNED'
       )
       SELECT
         COUNT(*)::int AS scans,
         COUNT(*) FILTER (WHERE qr_code_id IS NOT NULL)::int AS "attributedScans",
         COUNT(*) FILTER (WHERE qr_code_id IS NULL)::int AS "unattributedScans",
         CASE WHEN COUNT(*)=0 THEN 100
              ELSE ROUND((COUNT(*) FILTER (WHERE qr_code_id IS NOT NULL)::numeric / COUNT(*)::numeric) * 100, 1)::float
         END AS "attributionRate"
       FROM scanned`,
      [input.organizationId, input.days],
    );
    return result.rows[0] ?? { scans: 0, attributedScans: 0, unattributedScans: 0, attributionRate: 100 };
  }
}
