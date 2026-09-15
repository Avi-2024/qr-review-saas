import { AppError } from "@/server/core/errors";
import { getEnv } from "@/server/config/env";
import type { BillingInterval } from "@/server/billing/domain/billing";

export function isRazorpayBillingConfigured() {
  const env = getEnv();
  return env.BILLING_PROVIDER === "razorpay";
}

export function getRazorpayConfig() {
  const env = getEnv();
  if (env.BILLING_PROVIDER !== "razorpay") {
    throw new AppError("Paid billing is not configured in this environment.", 503, "BILLING_NOT_CONFIGURED");
  }

  return {
    keyId: env.RAZORPAY_KEY_ID!,
    keySecret: env.RAZORPAY_KEY_SECRET!,
    webhookSecret: env.RAZORPAY_WEBHOOK_SECRET!,
    timeoutMs: env.RAZORPAY_REQUEST_TIMEOUT_MS,
    plans: {
      starter: {
        monthly: env.RAZORPAY_PLAN_STARTER_MONTHLY!,
        yearly: env.RAZORPAY_PLAN_STARTER_YEARLY!,
      },
      growth: {
        monthly: env.RAZORPAY_PLAN_GROWTH_MONTHLY!,
        yearly: env.RAZORPAY_PLAN_GROWTH_YEARLY!,
      },
      business: {
        monthly: env.RAZORPAY_PLAN_BUSINESS_MONTHLY!,
        yearly: env.RAZORPAY_PLAN_BUSINESS_YEARLY!,
      },
    },
  };
}

export function getRazorpayPlanId(planCode: string, interval: BillingInterval) {
  const plans = getRazorpayConfig().plans;
  const plan = plans[planCode as keyof typeof plans];
  if (!plan) {
    throw new AppError("This plan is not configured for online checkout.", 400, "BILLING_PLAN_NOT_CHECKOUT_ENABLED");
  }
  return plan[interval];
}
