import { getEnv } from "@/server/config/env";
import { InMemoryRateLimiter } from "@/server/infrastructure/rate-limit/in-memory-rate-limiter";
import type { RateLimiter } from "@/server/infrastructure/rate-limit/rate-limiter";
import { UpstashRateLimiter } from "@/server/infrastructure/rate-limit/upstash-rate-limiter";

export function createConfiguredRateLimiter(scope: string, maxRequests: number, windowMs: number): RateLimiter {
  const env = getEnv();
  const fallback = new InMemoryRateLimiter(maxRequests, windowMs);

  if (env.RATE_LIMIT_BACKEND === "memory") return fallback;

  return new UpstashRateLimiter({
    restUrl: env.UPSTASH_REDIS_REST_URL!,
    token: env.UPSTASH_REDIS_REST_TOKEN!,
    keyPrefix: `${env.RATE_LIMIT_KEY_PREFIX}:${scope}`,
    keyHashSecret: env.IP_HASH_SECRET ?? "development-only-rate-limit-key",
    maxRequests,
    windowMs,
    requestTimeoutMs: env.RATE_LIMIT_REQUEST_TIMEOUT_MS,
    fallback,
  });
}
