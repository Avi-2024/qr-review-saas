export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "cancelled"
  | "expired"
  | "suspended";

export type BillingInterval = "monthly" | "yearly";

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
  billingInterval: BillingInterval;
  status: SubscriptionStatus;
  trialStartedAt: Date;
  trialEndsAt: Date;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  provider: string | null;
  providerPlanId: string | null;
  providerStatus: string | null;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  lastProviderEventAt: Date | null;
}

export interface BillingUsage {
  locations: number;
  qrCodes: number;
}

export interface BillingSnapshot {
  status: SubscriptionStatus;
  plan: BillingPlan;
  billingInterval: BillingInterval;
  trialStartedAt: Date;
  trialEndsAt: Date;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  provider: string | null;
  providerStatus: string | null;
  providerSubscriptionId: string | null;
  daysRemaining: number;
  canWrite: boolean;
  canCollectReviews: boolean;
  needsUpgrade: boolean;
  usage: BillingUsage;
}

export interface ProviderSubscriptionBinding {
  provider: string;
  providerPlanId: string;
  providerSubscriptionId: string;
  providerStatus: string;
  planCode: string;
  billingInterval: BillingInterval;
}

export interface ProviderPaymentRecord {
  providerPaymentId: string;
  providerInvoiceId?: string | null;
  amountPaise: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "failed" | "refunded";
  paidAt?: Date | null;
}

export interface ProviderSubscriptionEvent {
  provider: string;
  providerEventId: string;
  eventType: string;
  eventCreatedAt: Date;
  providerSubscriptionId: string;
  providerPlanId?: string | null;
  providerCustomerId?: string | null;
  providerStatus: string;
  status: SubscriptionStatus | null;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  payment?: ProviderPaymentRecord | null;
}
