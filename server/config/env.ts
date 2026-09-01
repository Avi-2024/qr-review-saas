import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1).optional(),
  REVIEW_REPOSITORY: z.enum(["memory", "postgres"]).optional(),
  IP_HASH_SECRET: z.string().min(16).optional(),
  REVIEW_SESSION_TTL_MINUTES: z.coerce.number().int().min(5).max(1440).default(60),
  REVIEW_SESSION_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),
  REVIEW_GENERATE_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(12),
  REVIEW_EVENT_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
  REVIEW_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(600_000),
});

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | null = null;

function assertProductionConfiguration(env: AppEnv) {
  if (env.NODE_ENV !== "production") return;

  if (env.REVIEW_REPOSITORY !== "postgres") {
    throw new Error("REVIEW_REPOSITORY=postgres is required in production.");
  }

  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required in production.");
  }

  if (!env.IP_HASH_SECRET || env.IP_HASH_SECRET.length < 32) {
    throw new Error("IP_HASH_SECRET must be at least 32 characters in production.");
  }
}

export function getEnv(): AppEnv {
  if (cached) return cached;

  const env = envSchema.parse(process.env);
  assertProductionConfiguration(env);
  cached = env;
  return env;
}
