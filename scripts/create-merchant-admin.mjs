import bcrypt from "bcryptjs";
import pg from "pg";

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
if (password.length < 12) throw new Error("MERCHANT_ADMIN_PASSWORD must be at least 12 characters.");

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
});
const client = await pool.connect();

try {
  await client.query("BEGIN");

  let organizationId;
  const existingOrg = await client.query(
    `SELECT id FROM organizations WHERE LOWER(name)=LOWER($1) ORDER BY created_at ASC LIMIT 1`,
    [organizationName],
  );
  organizationId = existingOrg.rows[0]?.id;
  if (!organizationId) {
    const insertedOrg = await client.query(`INSERT INTO organizations(name) VALUES ($1) RETURNING id`, [organizationName]);
    organizationId = insertedOrg.rows[0]?.id;
  }
  if (!organizationId) throw new Error("Could not resolve organization.");

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await client.query(
    `INSERT INTO merchant_users(email,password_hash,name)
     VALUES ($1,$2,$3)
     ON CONFLICT (email) DO UPDATE
       SET password_hash=EXCLUDED.password_hash,
           name=EXCLUDED.name,
           is_active=TRUE,
           updated_at=NOW()
     RETURNING id`,
    [email, passwordHash, name],
  );

  await client.query(
    `INSERT INTO organization_memberships(organization_id,user_id,role)
     VALUES ($1,$2,'owner')
     ON CONFLICT (organization_id,user_id) DO UPDATE SET role='owner'`,
    [organizationId, user.rows[0].id],
  );

  await client.query("COMMIT");
  console.log(`Merchant owner ready: ${email} -> ${organizationName}`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
