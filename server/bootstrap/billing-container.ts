import { BillingService } from "@/server/billing/application/services/billing-service";
import { PostgresBillingRepository } from "@/server/billing/infrastructure/postgres-billing-repository";
import { getPool } from "@/server/infrastructure/database/pool";

const globalForBilling = globalThis as typeof globalThis & {
  __billingService?: BillingService;
};

export function getBillingService() {
  if (globalForBilling.__billingService) return globalForBilling.__billingService;

  globalForBilling.__billingService = new BillingService(
    new PostgresBillingRepository(getPool()),
  );
  return globalForBilling.__billingService;
}
