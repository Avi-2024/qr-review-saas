import { getEnv } from "@/server/config/env";
import { getPool } from "@/server/infrastructure/database/pool";
import { MerchantService } from "@/server/merchant/application/services/merchant-service";
import { PostgresMerchantRepository } from "@/server/merchant/infrastructure/postgres-merchant-repository";

let merchantService: MerchantService | null = null;

export function getMerchantService() {
  if (merchantService) return merchantService;
  const env = getEnv();
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for merchant authentication and dashboard features.");
  }
  merchantService = new MerchantService(
    new PostgresMerchantRepository(getPool()),
    env.AUTH_SESSION_TTL_HOURS,
  );
  return merchantService;
}
