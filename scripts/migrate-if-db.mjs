import { execSync } from "node:child_process";

if (!process.env.DATABASE_URL) {
  console.log("[Build] No DATABASE_URL detected during build; skipping migrations.");
  process.exit(0);
}

console.log("[Build] DATABASE_URL detected! Running safe database migrations...");
try {
  execSync("node scripts/migrate.mjs", { stdio: "inherit" });
  console.log("[Build] Database migrations completed successfully!");
} catch (error) {
  console.warn("[Build Warning] Could not run migrations during build phase:", error.message);
  console.warn("[Build Warning] Migrations can be run manually with 'npm run db:migrate'.");
}
