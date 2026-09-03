import { describe, expect, it } from "vitest";
import { QrPerformanceService } from "@/server/analytics/application/services/qr-performance-service";
import type { QrPerformanceRepository } from "@/server/analytics/application/ports/qr-performance-repository";
import type { MerchantIdentity } from "@/server/merchant/domain/merchant";

const identity: MerchantIdentity = {
  userId: "00000000-0000-4000-8000-000000000001",
  email: "owner@example.com",
  name: "Owner",
  organizationId: "00000000-0000-4000-8000-000000000010",
  organizationName: "Example",
  businessType: "retail",
  onboardingStage: "complete",
  onboardingCompletedAt: new Date(),
  role: "owner",
};

function row(name: string, scans: number, conversionRate: number) {
  return {
    qrCodeId: crypto.randomUUID(),
    locationId: "00000000-0000-4000-8000-000000000020",
    locationName: "Main",
    qrName: name,
    sourceType: "counter",
    reference: null,
    isActive: true,
    scans,
    reviewsGenerated: Math.floor(scans * 0.8),
    googleOpens: Math.round(scans * conversionRate / 100),
    generationRate: scans ? 80 : 0,
    conversionRate,
    googleFromGeneratedRate: scans ? 75 : 0,
  };
}

describe("QrPerformanceService", () => {
  it("uses a minimum sample before naming the best converter and counts zero-activity QR assets", async () => {
    const repository: QrPerformanceRepository = {
      async listQrPerformance() { return [row("Tiny perfect", 1, 100), row("Reception", 20, 70), row("Billing", 25, 60), row("Unused", 0, 0)]; },
      async getAttributionSummary() { return { scans: 46, attributedScans: 46, unattributedScans: 0, attributionRate: 100 }; },
    };
    const result = await new QrPerformanceService(repository).getAnalytics(identity, { days: 30 });
    expect(result.mostScanned?.qrName).toBe("Billing");
    expect(result.bestConverter?.qrName).toBe("Reception");
    expect(result.zeroActivityCount).toBe(1);
  });

  it("clamps the date range and ignores malformed location filters", async () => {
    let received: { days: number; locationId?: string | null } | null = null;
    const repository: QrPerformanceRepository = {
      async listQrPerformance(input) { received = { days: input.days, locationId: input.locationId }; return []; },
      async getAttributionSummary() { return { scans: 0, attributedScans: 0, unattributedScans: 0, attributionRate: 100 }; },
    };
    const result = await new QrPerformanceService(repository).getAnalytics(identity, { days: 500, locationId: "not-a-uuid" });
    expect(result.days).toBe(90);
    expect(result.locationId).toBeNull();
    expect(received).toEqual({ days: 90, locationId: null });
  });
});
