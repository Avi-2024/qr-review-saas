import { AppError, ConflictError, NotFoundError } from "@/server/core/errors";
import type { BillingRepository } from "@/server/billing/application/ports/billing-repository";
import type {
  BillingSnapshot,
  OrganizationSubscription,
  SubscriptionStatus,
} from "@/server/billing/domain/billing";

const DAY_MS = 24 * 60 * 60 * 1000;
const PAST_DUE_GRACE_MS = 3 * DAY_MS;

export class BillingService {
  constructor(private readonly repository: BillingRepository) {}

  listPlans() {
    return this.repository.listPlans();
  }

  async getSnapshot(organizationId: string, now = new Date()): Promise<BillingSnapshot> {
    let subscription = await this.repository.getSubscription(organizationId);
    if (!subscription) {
      throw new NotFoundError("Subscription not found for this organization.", "SUBSCRIPTION_NOT_FOUND");
    }

    if (subscription.status === "trialing" && subscription.trialEndsAt.getTime() <= now.getTime()) {
      subscription = await this.repository.updateSubscriptionStatus(organizationId, "expired") ?? {
        ...subscription,
        status: "expired",
      };
    }

    const [plan, usage] = await Promise.all([
      this.repository.getPlan(subscription.planCode),
      this.repository.getUsage(organizationId),
    ]);
    if (!plan) throw new NotFoundError("Subscription plan not found.", "BILLING_PLAN_NOT_FOUND");

    const canUse = this.canUseSubscription(subscription, now);
    const daysRemaining = subscription.status === "trialing"
      ? Math.max(0, Math.ceil((subscription.trialEndsAt.getTime() - now.getTime()) / DAY_MS))
      : 0;

    return {
      status: subscription.status,
      plan,
      trialStartedAt: subscription.trialStartedAt,
      trialEndsAt: subscription.trialEndsAt,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      daysRemaining,
      canWrite: canUse,
      canCollectReviews: canUse,
      needsUpgrade: !canUse,
      usage,
    };
  }

  async assertCanWrite(organizationId: string) {
    const snapshot = await this.getSnapshot(organizationId);
    if (!snapshot.canWrite) this.throwSubscriptionRequired(snapshot.status, snapshot.trialEndsAt);
    return snapshot;
  }

  async assertCanCollectReviews(organizationId: string) {
    const snapshot = await this.getSnapshot(organizationId);
    if (!snapshot.canCollectReviews) this.throwSubscriptionRequired(snapshot.status, snapshot.trialEndsAt);
    return snapshot;
  }

  async assertCanCollectReviewsForQrToken(qrToken: string) {
    const organizationId = await this.repository.getOrganizationIdForQrToken(qrToken);
    if (!organizationId) {
      throw new NotFoundError("QR code not found or inactive.", "QR_NOT_FOUND");
    }
    return this.assertCanCollectReviews(organizationId);
  }

  async assertLocationCapacity(organizationId: string) {
    const snapshot = await this.assertCanWrite(organizationId);
    if (snapshot.usage.locations >= snapshot.plan.maxLocations) {
      throw new ConflictError(
        `Your ${snapshot.plan.name} plan allows up to ${snapshot.plan.maxLocations} location${snapshot.plan.maxLocations === 1 ? "" : "s"}. Upgrade to add another location.`,
        "PLAN_LOCATION_LIMIT_REACHED",
      );
    }
    return snapshot;
  }

  async assertQrCapacity(organizationId: string) {
    const snapshot = await this.assertCanWrite(organizationId);
    if (snapshot.usage.qrCodes >= snapshot.plan.maxQrCodes) {
      throw new ConflictError(
        `Your ${snapshot.plan.name} plan allows up to ${snapshot.plan.maxQrCodes} QR codes. Upgrade to add another QR code.`,
        "PLAN_QR_LIMIT_REACHED",
      );
    }
    return snapshot;
  }

  private canUseSubscription(subscription: OrganizationSubscription, now: Date) {
    if (subscription.status === "active") return true;
    if (subscription.status === "trialing") return subscription.trialEndsAt.getTime() > now.getTime();
    if (subscription.status === "past_due" && subscription.currentPeriodEnd) {
      return subscription.currentPeriodEnd.getTime() + PAST_DUE_GRACE_MS > now.getTime();
    }
    return false;
  }

  private throwSubscriptionRequired(status: SubscriptionStatus, trialEndsAt: Date): never {
    throw new AppError(
      status === "expired"
        ? "Your free trial has ended. Choose a plan to continue using QR Review."
        : "An active subscription is required to continue using QR Review.",
      402,
      "SUBSCRIPTION_REQUIRED",
      { status, trialEndsAt: trialEndsAt.toISOString() },
    );
  }
}
