import type {
  BillingPlan,
  BillingUsage,
  OrganizationSubscription,
  SubscriptionStatus,
} from "@/server/billing/domain/billing";

export interface BillingRepository {
  getSubscription(organizationId: string): Promise<OrganizationSubscription | null>;
  getPlan(code: string): Promise<BillingPlan | null>;
  listPlans(): Promise<BillingPlan[]>;
  getUsage(organizationId: string): Promise<BillingUsage>;
  getOrganizationIdForQrToken(qrToken: string): Promise<string | null>;
  updateSubscriptionStatus(
    organizationId: string,
    status: SubscriptionStatus,
  ): Promise<OrganizationSubscription | null>;
}
