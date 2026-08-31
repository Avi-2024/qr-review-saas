import { Pool } from "pg";
import { getEnv } from "@/server/config/env";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (pool) return pool;

  const { DATABASE_URL } = getEnv();
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is required when using the PostgreSQL repository.");
  }

  pool = new Pool({
    connectionString: DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
  });

  return pool;
}
