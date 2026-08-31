import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
});

try {
  const migrationPath = path.join(process.cwd(), "database/migrations/001_initial.sql");
  const sql = await fs.readFile(migrationPath, "utf8");
  await pool.query(sql);
  console.log("Database migration completed successfully.");
} finally {
  await pool.end();
}
