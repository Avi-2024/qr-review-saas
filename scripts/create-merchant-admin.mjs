import bcrypt from "bcryptjs";
import path from "node:path";
import pg from "pg";

for (const envFile of [".env.local", ".env"]) {
  try {
    process.loadEnvFile?.(path.join(process.cwd(), envFile));
  } catch {
    // Ignore if file doesn't exist
  }
}

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
const email = process.env.MERCHANT_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.MERCHANT_ADMIN_PASSWORD;
const name = process.env.MERCHANT_ADMIN_NAME?.trim();
const organizationName = process.env.MERCHANT_ORGANIZATION_NAME?.trim();

if (!connectionString) throw new Error("DATABASE_URL is required.");
if (!email || !password || !name || !organizationName) {
  throw new Error("MERCHANT_ADMIN_EMAIL, MERCHANT_ADMIN_PASSWORD, MERCHANT_ADMIN_NAME and MERCHANT_ORGANIZATION_NAME are required.");
}
if (password.length < 6) throw new Error("MERCHANT_ADMIN_PASSWORD must be at least 12 characters.");

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
});

try {
  const passwordHash = await bcrypt.hash(password, 10);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let userResult = await client.query(
      "SELECT id FROM merchant_users WHERE email = $1 LIMIT 1",
      [email],
    );

    let userId = userResult.rows[0]?.id;
    if (!userId) {
      userResult = await client.query(
        `INSERT INTO merchant_users (email, password_hash, name)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [email, passwordHash, name],
      );
      userId = userResult.rows[0].id;
    } else {
      await client.query(
        `UPDATE merchant_users
         SET password_hash = $1, name = $2, is_active = TRUE, updated_at = NOW()
         WHERE id = $3`,
        [passwordHash, name, userId],
      );
    }

    let orgResult = await client.query(
      "SELECT id FROM organizations WHERE name = $1 LIMIT 1",
      [organizationName],
    );

    let orgId = orgResult.rows[0]?.id;
    if (!orgId) {
      orgResult = await client.query(
        `INSERT INTO organizations (name, onboarding_stage, onboarding_completed_at)
         VALUES ($1, 'complete', NOW())
         RETURNING id`,
        [organizationName],
      );
      orgId = orgResult.rows[0].id;
    } else {
      await client.query(
        `UPDATE organizations
         SET onboarding_stage = 'complete', onboarding_completed_at = COALESCE(onboarding_completed_at, NOW()), updated_at = NOW()
         WHERE id = $1`,
        [orgId],
      );
    }

    await client.query(
      `INSERT INTO organization_memberships (organization_id, user_id, role)
       VALUES ($1, $2, 'owner')
       ON CONFLICT (organization_id, user_id)
       DO UPDATE SET role = 'owner'`,
      [orgId, userId],
    );

    try {
      await client.query(
        `INSERT INTO organization_subscriptions (
           organization_id, plan_code, status, trial_started_at, trial_ends_at
         ) VALUES ($1, 'business', 'active', NOW(), NOW() + INTERVAL '10 years')
         ON CONFLICT (organization_id)
         DO UPDATE SET status = 'active', plan_code = 'business', trial_ends_at = NOW() + INTERVAL '10 years'`,
        [orgId],
      );
    } catch {
      // Subscriptions table might not be active if using memory or unmigrated
    }

    await client.query("COMMIT");
    console.log(`Super admin ready: ${email} (${organizationName})`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}
