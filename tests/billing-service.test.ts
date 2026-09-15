import { describe, expect, it } from "vitest";
import { BillingService } from "@/server/billing/application/services/billing-service";
import type { BillingRepository } from "@/server/billing/application/ports/billing-repository";
import type {
  BillingPlan,
  BillingUsage,
  OrganizationSubscription,
  SubscriptionStatus,
} from "@/server/billing/domain/billing";

const ORG_ID = "00000000-0000-4000-8000-000000000001";
const NOW = new Date("2026-09-15T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

const starter: BillingPlan = {
  code: "starter",
  name: "Starter",
  monthlyPricePaise: 49_900,
  yearlyPricePaise: 499_000,
  maxLocations: 1,
  maxQrCodes: 5,
  isActive: true,
};

function subscription(overrides: Partial<OrganizationSubscription> = {}): OrganizationSubscription {
  return {
    id: "00000000-0000-4000-8000-000000000002",
    organizationId: ORG_ID,
    planCode: "starter",
    status: "trialing",
    trialStartedAt: new Date(NOW.getTime() - DAY),
    trialEndsAt: new Date(NOW.getTime() + 6 * DAY),
    currentPeriodStart: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    provider: null,
    providerCustomerId: null,
    providerSubscriptionId: null,
    ...overrides,
  };
}

class FakeBillingRepository implements BillingRepository {
  current: OrganizationSubscription;
  usage: BillingUsage;

  constructor(current = subscription(), usage: BillingUsage = { locations: 0, qrCodes: 0 }) {
    this.current = current;
    this.usage = usage;
  }

  async getSubscription(organizationId: string) {
    return organizationId === ORG_ID ? this.current : null;
  }

  async getPlan(code: string) {
    return code === starter.code ? starter : null;
  }

  async listPlans() {
    return [starter];
  }

  async getUsage() {
    return this.usage;
  }

  async getOrganizationIdForQrToken(qrToken: string) {
    return qrToken === "active-qr" ? ORG_ID : null;
  }

  async updateSubscriptionStatus(_organizationId: string, status: SubscriptionStatus) {
    this.current = { ...this.current, status };
    return this.current;
  }
}

describe("BillingService", () => {
  it("allows full access during a valid seven-day trial", async () => {
    const service = new BillingService(new FakeBillingRepository());
    const snapshot = await service.getSnapshot(ORG_ID, NOW);

    expect(snapshot.status).toBe("trialing");
    expect(snapshot.daysRemaining).toBe(6);
    expect(snapshot.canWrite).toBe(true);
    expect(snapshot.canCollectReviews).toBe(true);
    expect(snapshot.needsUpgrade).toBe(false);
  });

  it("expires a trial exactly at its end and preserves read access state", async () => {
    const repo = new FakeBillingRepository(subscription({ trialEndsAt: NOW }));
    const service = new BillingService(repo);
    const snapshot = await service.getSnapshot(ORG_ID, NOW);

    expect(repo.current.status).toBe("expired");
    expect(snapshot.status).toBe("expired");
    expect(snapshot.canWrite).toBe(false);
    expect(snapshot.canCollectReviews).toBe(false);
    expect(snapshot.needsUpgrade).toBe(true);
  });

  it("allows an active paid subscription", async () => {
    const repo = new FakeBillingRepository(subscription({
      status: "active",
      currentPeriodStart: new Date(NOW.getTime() - DAY),
      currentPeriodEnd: new Date(NOW.getTime() + 29 * DAY),
    }));
    const service = new BillingService(repo);

    await expect(service.assertCanWrite(ORG_ID)).resolves.toMatchObject({ status: "active" });
  });

  it("allows a past-due subscription only inside the three-day grace window", async () => {
    const repo = new FakeBillingRepository(subscription({
      status: "past_due",
      currentPeriodEnd: new Date(Date.now() + DAY),
    }));
    const service = new BillingService(repo);

    await expect(service.assertCanWrite(ORG_ID)).resolves.toMatchObject({ status: "past_due" });

    repo.current = subscription({
      status: "past_due",
      currentPeriodEnd: new Date(Date.now() - 4 * DAY),
    });
    await expect(service.assertCanWrite(ORG_ID)).rejects.toMatchObject({
      code: "SUBSCRIPTION_REQUIRED",
      statusCode: 402,
    });
  });

  it("enforces Starter location and QR capacity", async () => {
    const repo = new FakeBillingRepository(subscription(), { locations: 1, qrCodes: 5 });
    const service = new BillingService(repo);

    await expect(service.assertLocationCapacity(ORG_ID)).rejects.toMatchObject({
      code: "PLAN_LOCATION_LIMIT_REACHED",
      statusCode: 409,
    });
    await expect(service.assertQrCapacity(ORG_ID)).rejects.toMatchObject({
      code: "PLAN_QR_LIMIT_REACHED",
      statusCode: 409,
    });
  });

  it("resolves the owning organization before allowing a public QR session", async () => {
    const service = new BillingService(new FakeBillingRepository());

    await expect(service.assertCanCollectReviewsForQrToken("active-qr")).resolves.toMatchObject({ canCollectReviews: true });
    await expect(service.assertCanCollectReviewsForQrToken("missing-qr")).rejects.toMatchObject({
      code: "QR_NOT_FOUND",
      statusCode: 404,
    });
  });
});
