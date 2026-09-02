import bcrypt from "bcryptjs";
import { describe, expect, it, vi } from "vitest";
import { MerchantService } from "@/server/merchant/application/services/merchant-service";
import type { MerchantRepository } from "@/server/merchant/application/ports/merchant-repository";
import type { MerchantIdentity, MerchantLocation, MerchantQrCode } from "@/server/merchant/domain/merchant";

function repository(overrides: Partial<MerchantRepository> = {}) {
  return {
    findUserForLogin: vi.fn(),
    createSession: vi.fn(),
    getIdentityBySessionTokenHash: vi.fn(),
    revokeSession: vi.fn(),
    touchSession: vi.fn(),
    getOrganizationProfile: vi.fn(),
    saveOnboardingBusiness: vi.fn(),
    createOnboardingLocation: vi.fn(),
    listLocationTopics: vi.fn().mockResolvedValue([]),
    replaceOnboardingTopics: vi.fn(),
    createOnboardingQrCode: vi.fn(),
    completeOnboarding: vi.fn(),
    getDashboardSummary: vi.fn(),
    getFunnel: vi.fn(),
    getTrend: vi.fn(),
    listLocations: vi.fn().mockResolvedValue([]),
    getLocation: vi.fn(),
    isLocationPublicIdAvailable: vi.fn().mockResolvedValue(true),
    createLocation: vi.fn(),
    updateLocation: vi.fn(),
    listQrCodes: vi.fn().mockResolvedValue([]),
    getQrCode: vi.fn(),
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
  businessType: "retail",
  onboardingStage: "complete",
  onboardingCompletedAt: new Date(),
  role: "owner",
};

const incompleteOwner: MerchantIdentity = {
  ...owner,
  businessType: null,
  onboardingStage: "business",
  onboardingCompletedAt: null,
};

const viewer: MerchantIdentity = { ...owner, role: "viewer" };

function location(isActive = true): MerchantLocation {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    publicId: "main-store",
    name: "Main Store",
    subtitle: "Quick feedback",
    googlePlaceId: "ChIJ-abc123",
    googleReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJ-abc123",
    isActive,
    createdAt: new Date(),
  };
}

function qr(isActive = true): MerchantQrCode {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    locationId: location().id,
    locationName: "Main Store",
    publicToken: "counter-test",
    name: "Counter",
    sourceType: "counter",
    reference: null,
    isActive,
    createdAt: new Date(),
  };
}

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

  it("advances the business onboarding step without locking the business type to an enum", async () => {
    const saved = {
      id: "org-1",
      name: "Happy Paws",
      businessType: "Pet grooming and daycare",
      onboardingStage: "location" as const,
      onboardingCompletedAt: null,
    };
    const saveOnboardingBusiness = vi.fn().mockResolvedValue(saved);
    const service = new MerchantService(repository({ saveOnboardingBusiness }), 24);

    const result = await service.saveOnboardingBusiness(incompleteOwner, {
      businessName: "Happy Paws",
      businessType: "Pet grooming and daycare",
    });

    expect(result).toEqual(saved);
    expect(saveOnboardingBusiness).toHaveBeenCalledWith("org-1", {
      name: "Happy Paws",
      businessType: "Pet grooming and daycare",
    });
  });

  it("rejects duplicate onboarding topic labels before writing", async () => {
    const service = new MerchantService(repository(), 24);
    const topicsIdentity: MerchantIdentity = { ...incompleteOwner, onboardingStage: "topics" };

    await expect(service.saveOnboardingTopics(topicsIdentity, {
      locationId: location().id,
      topics: [
        { label: "Staff" },
        { label: "staff" },
        { label: "Speed" },
      ],
    })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("prevents viewer role from creating QR codes", async () => {
    const service = new MerchantService(repository(), 24);
    await expect(service.createQrCode(viewer, { locationId: location().id, name: "Counter" })).rejects.toMatchObject({ code: "FORBIDDEN" });
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

  it("returns a conflict for an explicitly duplicated public location id", async () => {
    const service = new MerchantService(repository({
      isLocationPublicIdAvailable: vi.fn().mockResolvedValue(false),
    }), 24);

    await expect(service.createLocation(owner, {
      name: "Main Store",
      publicId: "existing-store",
      googlePlaceId: "ChIJ-abc123",
    })).rejects.toMatchObject({ code: "LOCATION_PUBLIC_ID_TAKEN", statusCode: 409 });
  });

  it("allocates a bounded unique suffix when an automatic location slug collides", async () => {
    const availability = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const createLocation = vi.fn().mockImplementation(async (_orgId, input) => ({ id: "loc-2", createdAt: new Date(), ...input }));
    const service = new MerchantService(repository({ isLocationPublicIdAvailable: availability, createLocation }), 24);

    await service.createLocation(owner, { name: "Main Store", googlePlaceId: "ChIJ-abc123" });

    const createdInput = createLocation.mock.calls[0][1];
    expect(createdInput.publicId).toMatch(/^main-store-[a-z0-9_-]+$/);
    expect(availability).toHaveBeenCalledTimes(2);
  });

  it("blocks creating a QR code for an inactive location", async () => {
    const createQrCode = vi.fn();
    const service = new MerchantService(repository({
      getLocation: vi.fn().mockResolvedValue(location(false)),
      createQrCode,
    }), 24);

    await expect(service.createQrCode(owner, { locationId: location().id, name: "Counter" }))
      .rejects.toMatchObject({ code: "LOCATION_INACTIVE", statusCode: 409 });
    expect(createQrCode).not.toHaveBeenCalled();
  });

  it("blocks activating a QR code while its location is inactive", async () => {
    const updateQrCodeStatus = vi.fn();
    const service = new MerchantService(repository({
      getQrCode: vi.fn().mockResolvedValue(qr(false)),
      getLocation: vi.fn().mockResolvedValue(location(false)),
      updateQrCodeStatus,
    }), 24);

    await expect(service.updateQrCodeStatus(owner, qr().id, true))
      .rejects.toMatchObject({ code: "LOCATION_INACTIVE", statusCode: 409 });
    expect(updateQrCodeStatus).not.toHaveBeenCalled();
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
