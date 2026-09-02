import bcrypt from "bcryptjs";
import { describe, expect, it, vi } from "vitest";
import { MerchantService } from "@/server/merchant/application/services/merchant-service";
import type { MerchantRepository } from "@/server/merchant/application/ports/merchant-repository";
import type { MerchantIdentity } from "@/server/merchant/domain/merchant";

function repository(overrides: Partial<MerchantRepository> = {}) {
  return {
    findUserForLogin: vi.fn(),
    createSession: vi.fn(),
    getIdentityBySessionTokenHash: vi.fn(),
    revokeSession: vi.fn(),
    touchSession: vi.fn(),
    getDashboardSummary: vi.fn(),
    getFunnel: vi.fn(),
    getTrend: vi.fn(),
    listLocations: vi.fn(),
    createLocation: vi.fn(),
    updateLocation: vi.fn(),
    listQrCodes: vi.fn(),
    createQrCode: vi.fn(),
    updateQrCodeStatus: vi.fn(),
    ...overrides,
  } as unknown as MerchantRepository;
}

const owner: MerchantIdentity = {
  userId: "user-1",
  email: "owner@example.com",
  name: "Owner",
  organizationId: "org-1",
  organizationName: "Mangal Traders",
  role: "owner",
};

const viewer: MerchantIdentity = { ...owner, role: "viewer" };

describe("MerchantService", () => {
  it("creates an organization-bound session for valid credentials", async () => {
    const passwordHash = await bcrypt.hash("strong-password-123", 4);
    const createSession = vi.fn();
    const repo = repository({
      findUserForLogin: vi.fn().mockResolvedValue({ ...owner, passwordHash }),
      createSession,
    });
    const service = new MerchantService(repo, 24);

    const result = await service.login({ email: owner.email, password: "strong-password-123" });

    expect(result.identity.organizationId).toBe("org-1");
    expect(result.token.length).toBeGreaterThan(20);
    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1", organizationId: "org-1" }));
  });

  it("rejects invalid passwords without creating a session", async () => {
    const passwordHash = await bcrypt.hash("correct-password-123", 4);
    const createSession = vi.fn();
    const service = new MerchantService(repository({
      findUserForLogin: vi.fn().mockResolvedValue({ ...owner, passwordHash }),
      createSession,
    }), 24);

    await expect(service.login({ email: owner.email, password: "wrong-password-123" })).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    expect(createSession).not.toHaveBeenCalled();
  });

  it("prevents viewer role from creating QR codes", async () => {
    const service = new MerchantService(repository(), 24);
    await expect(service.createQrCode(viewer, { locationId: "loc-1", name: "Counter" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("builds the direct Google review URL when creating a location", async () => {
    const createLocation = vi.fn().mockImplementation(async (_orgId, input) => ({ id: "loc-1", createdAt: new Date(), ...input }));
    const service = new MerchantService(repository({ createLocation }), 24);

    await service.createLocation(owner, { name: "Main Store", googlePlaceId: "ChIJ-abc123" });

    expect(createLocation).toHaveBeenCalledWith("org-1", expect.objectContaining({
      publicId: "main-store",
      googleReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJ-abc123",
      isActive: true,
    }));
  });

  it("clamps analytics windows to 7-90 days", async () => {
    const summary = vi.fn().mockResolvedValue({ locations:0,qrCodes:0,scans:0,reviewsGenerated:0,googleOpens:0,conversionRate:0 });
    const funnel = vi.fn().mockResolvedValue([]);
    const trend = vi.fn().mockResolvedValue([]);
    const service = new MerchantService(repository({ getDashboardSummary: summary, getFunnel: funnel, getTrend: trend }), 24);

    const result = await service.dashboard(owner, 365);
    expect(result.days).toBe(90);
    expect(summary).toHaveBeenCalledWith("org-1", 90);
  });
});
