import { getEnv } from "@/server/config/env";
import { getPool } from "@/server/infrastructure/database/pool";
import { InMemoryRateLimiter } from "@/server/infrastructure/rate-limit/in-memory-rate-limiter";
import { MerchantService } from "@/server/merchant/application/services/merchant-service";
import { PostgresMerchantRepository } from "@/server/merchant/infrastructure/postgres-merchant-repository";

const globalForMerchant = globalThis as typeof globalThis & {
  __merchantService?: MerchantService;
  __merchantLoginLimiter?: InMemoryRateLimiter;
};

export function getMerchantService() {
  if (globalForMerchant.__merchantService) return globalForMerchant.__merchantService;
  const env = getEnv();
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for merchant authentication and dashboard features.");
  }
  globalForMerchant.__merchantService = new MerchantService(
    new PostgresMerchantRepository(getPool()),
    env.AUTH_SESSION_TTL_HOURS,
  );
  return globalForMerchant.__merchantService;
}

export function getMerchantLoginRateLimiter() {
  if (globalForMerchant.__merchantLoginLimiter) return globalForMerchant.__merchantLoginLimiter;
  const env = getEnv();
  globalForMerchant.__merchantLoginLimiter = new InMemoryRateLimiter(
    env.AUTH_LOGIN_RATE_LIMIT_MAX,
    env.REVIEW_RATE_LIMIT_WINDOW_MS,
  );
  return globalForMerchant.__merchantLoginLimiter;
}
