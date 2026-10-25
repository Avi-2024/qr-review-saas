import { Pool } from "pg";
import { getEnv } from "@/server/config/env";

export const runtime = "nodejs";

export async function GET() {
  let envStatus = "ok";
  let envError: string | null = null;
  let dbUrlConfigured = Boolean(process.env.DATABASE_URL);

  try {
    getEnv();
  } catch (err) {
    envStatus = "failed";
    envError = err instanceof Error ? err.message : String(err);
  }

  let dbStatus = "unconfigured";
  let dbError: string | null = null;
  let migrationsCount = 0;
  let adminConfigured = false;

  if (dbUrlConfigured) {
    let pool: Pool | null = null;
    try {
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000,
      });

      const ping = await pool.query("SELECT 1 as connected");
      dbStatus = ping.rows[0]?.connected ? "connected" : "failed";

      const migRes = await pool
        .query<{ count: string }>("SELECT count(*) FROM schema_migrations")
        .catch(() => null);
      migrationsCount = migRes ? Number(migRes.rows[0]?.count || 0) : 0;

      const adminRes = await pool
        .query<{ count: string }>("SELECT count(*) FROM merchant_users WHERE is_active = true")
        .catch(() => null);
      adminConfigured = Boolean(adminRes && Number(adminRes.rows[0]?.count || 0) > 0);
    } catch (err) {
      dbStatus = "error";
      dbError = err instanceof Error ? err.message : String(err);
    } finally {
      await pool?.end().catch(() => null);
    }
  }

  const isHealthy = envStatus === "ok" && (dbStatus === "connected" || !dbUrlConfigured);

  return Response.json({
    status: isHealthy ? "healthy" : "degraded",
    environment: process.env.NODE_ENV,
    envValidation: {
      status: envStatus,
      error: envError,
    },
    database: {
      configured: dbUrlConfigured,
      status: dbStatus,
      error: dbError,
      migrationsApplied: migrationsCount,
      adminExists: adminConfigured,
    },
    rateLimiting: {
      backend: process.env.RATE_LIMIT_BACKEND || "memory",
      upstashReady: Boolean(
        process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
      ),
    },
    service: "qr-review-saas",
    timestamp: new Date().toISOString(),
  });
}
