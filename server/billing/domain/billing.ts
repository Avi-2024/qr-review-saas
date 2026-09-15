export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "cancelled"
  | "expired"
  | "suspended";

export interface BillingPlan {
  code: string;
  name: string;
  monthlyPricePaise: number;
  yearlyPricePaise: number;
  maxLocations: number;
  maxQrCodes: number;
  isActive: boolean;
}

export interface OrganizationSubscription {
  id: string;
  organizationId: string;
  planCode: string;
  status: SubscriptionStatus;
  trialStartedAt: Date;
  trialEndsAt: Date;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  provider: string | null;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
}

export interface BillingUsage {
  locations: number;
  qrCodes: number;
}

export interface BillingSnapshot {
  status: SubscriptionStatus;
  plan: BillingPlan;
  trialStartedAt: Date;
  trialEndsAt: Date;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  daysRemaining: number;
  canWrite: boolean;
  canCollectReviews: boolean;
  needsUpgrade: boolean;
  usage: BillingUsage;
}
