import { getEnv } from "@/server/config/env";
import { getPool } from "@/server/infrastructure/database/pool";
import { MerchantSignupService } from "@/server/merchant/signup/signup-service";
import { PostgresMerchantSignupRepository } from "@/server/merchant/signup/postgres-signup-repository";

const globalForMerchantSignup = globalThis as typeof globalThis & {
  __merchantSignupService?: MerchantSignupService;
};

export function getMerchantSignupService() {
  if (globalForMerchantSignup.__merchantSignupService) return globalForMerchantSignup.__merchantSignupService;
  const env = getEnv();
  globalForMerchantSignup.__merchantSignupService = new MerchantSignupService(
    new PostgresMerchantSignupRepository(getPool()),
    env.AUTH_SESSION_TTL_HOURS,
  );
  return globalForMerchantSignup.__merchantSignupService;
}
