import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url().optional(),
  REVIEW_REPOSITORY: z.enum(["memory", "postgres"]).optional(),
  REVIEW_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(12),
  REVIEW_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(600_000),
});

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cached) return cached;
  cached = envSchema.parse(process.env);
  return cached;
}
