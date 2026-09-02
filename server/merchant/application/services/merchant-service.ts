import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import {
  AuthenticationError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/server/core/errors";
import type { MerchantRepository } from "@/server/merchant/application/ports/merchant-repository";
import type {
  MerchantIdentity,
  MerchantLocation,
  MerchantOnboardingStage,
  MerchantRole,
} from "@/server/merchant/domain/merchant";
import { createSessionToken, hashSessionToken } from "@/server/auth/session-token";

const WRITE_ROLES: MerchantRole[] = ["owner", "admin", "manager"];
const ONBOARDING_ORDER: MerchantOnboardingStage[] = ["business", "location", "topics", "qr", "ready", "complete"];

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
}

function randomSuffix(bytes = 4) {
  return randomBytes(bytes).toString("base64url").toLowerCase();
}

function hasDatabaseCode(error: unknown, code: string) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === code;
}

function stageAfter(stage: MerchantOnboardingStage, target: MerchantOnboardingStage) {
  return ONBOARDING_ORDER.indexOf(stage) > ONBOARDING_ORDER.indexOf(target);
}

export class MerchantService {
  constructor(
    private readonly repository: MerchantRepository,
    private readonly sessionTtlHours: number,
  ) {}

  async login(input: { email: string; password: string; userAgent?: string; ipHash?: string }) {
    const account = await this.repository.findUserForLogin(input.email.trim().toLowerCase());
    if (!account) throw new AuthenticationError("Invalid email or password.", "INVALID_CREDENTIALS");
    const valid = await bcrypt.compare(input.password, account.passwordHash);
    if (!valid) throw new AuthenticationError("Invalid email or password.", "INVALID_CREDENTIALS");

    const token = createSessionToken();
    const expiresAt = new Date(Date.now() + this.sessionTtlHours * 60 * 60 * 1000);
    await this.repository.createSession({
      userId: account.userId,
      organizationId: account.organizationId,
      tokenHash: hashSessionToken(token),
      userAgent: input.userAgent,
      ipHash: input.ipHash,
      expiresAt,
    });

    const { passwordHash: _passwordHash, ...identity } = account;
    return { token, expiresAt, identity };
  }

  async getIdentity(token: string) {
    const tokenHash = hashSessionToken(token);
    const identity = await this.repository.getIdentityBySessionTokenHash(tokenHash);
    if (!identity) throw new AuthenticationError();
    void this.repository.touchSession(tokenHash).catch(() => undefined);
    return identity;
  }

  async logout(token: string) {
    await this.repository.revokeSession(hashSessionToken(token));
  }

  async onboardingState(identity: MerchantIdentity) {
    const [organization, locations, qrCodes] = await Promise.all([
      this.repository.getOrganizationProfile(identity.organizationId),
      this.repository.listLocations(identity.organizationId),
      this.repository.listQrCodes(identity.organizationId),
    ]);
    if (!organization) throw new NotFoundError("Organization not found.", "ORGANIZATION_NOT_FOUND");
    const primaryLocation = locations[0] ?? null;
    const topics = primaryLocation
      ? await this.repository.listLocationTopics(identity.organizationId, primaryLocation.id)
      : [];
    return { organization, locations, topics, qrCodes };
  }

  async saveOnboardingBusiness(identity: MerchantIdentity, input: { businessName: string; businessType: string }) {
    this.assertCanWrite(identity);
    const profile = await this.repository.saveOnboardingBusiness(identity.organizationId, {
      name: input.businessName.trim(),
      businessType: input.businessType.trim(),
    });
    if (!profile) throw new ConflictError("This organization has already completed onboarding.", "ONBOARDING_ALREADY_COMPLETE");
    return profile;
  }

  async createOnboardingLocation(identity: MerchantIdentity, input: { name: string; subtitle?: string; googlePlaceId: string; publicId?: string }) {
    this.assertCanWrite(identity);
    const before = await this.onboardingState(identity);
    if (before.organization.onboardingStage !== "location") {
      if (stageAfter(before.organization.onboardingStage, "location") && before.locations[0]) return before.locations[0];
      throw new ConflictError("Complete the business step before adding your first location.", "ONBOARDING_STAGE_INVALID");
    }

    const publicId = await this.resolveLocationPublicId(input.publicId, input.name);
    const googlePlaceId = input.googlePlaceId.trim();
    try {
      const created = await this.repository.createOnboardingLocation(identity.organizationId, {
        publicId,
        name: input.name.trim(),
        subtitle: input.subtitle?.trim() || "Share your experience in a few taps.",
        googlePlaceId,
        googleReviewUrl: `https://search.google.com/local/writereview?placeid=${encodeURIComponent(googlePlaceId)}`,
        isActive: true,
      });
      if (created) return created;

      const after = await this.onboardingState(identity);
      if (stageAfter(after.organization.onboardingStage, "location") && after.locations[0]) return after.locations[0];
      throw new ConflictError("The onboarding location step is no longer available.", "ONBOARDING_STAGE_INVALID");
    } catch (error) {
      if (hasDatabaseCode(error, "23505")) {
        throw new ConflictError("That public location identifier was just taken. Please try again.", "LOCATION_PUBLIC_ID_TAKEN");
      }
      throw error;
    }
  }

  async saveOnboardingTopics(identity: MerchantIdentity, input: { locationId: string; topics: Array<{ label: string; icon?: string }> }) {
    this.assertCanWrite(identity);
    const normalized = input.topics.map((topic) => ({
      label: topic.label.trim(),
      icon: topic.icon?.trim() || "•",
    }));
    if (normalized.length < 3 || normalized.length > 8) {
      throw new ValidationError("Choose between 3 and 8 review topics.");
    }
    const labels = normalized.map((topic) => topic.label.toLowerCase());
    if (new Set(labels).size !== labels.length) {
      throw new ValidationError("Review topic labels must be unique.");
    }

    const before = await this.onboardingState(identity);
    if (before.organization.onboardingStage !== "topics") {
      if (stageAfter(before.organization.onboardingStage, "topics")) {
        return this.repository.listLocationTopics(identity.organizationId, input.locationId);
      }
      throw new ConflictError("Create your first location before customizing review topics.", "ONBOARDING_STAGE_INVALID");
    }

    const topics = await this.repository.replaceOnboardingTopics(identity.organizationId, input.locationId, normalized);
    if (topics) return topics;

    const after = await this.onboardingState(identity);
    if (stageAfter(after.organization.onboardingStage, "topics")) {
      return this.repository.listLocationTopics(identity.organizationId, input.locationId);
    }
    throw new ConflictError("Could not save onboarding topics for this location.", "ONBOARDING_TOPICS_INVALID");
  }

  async createOnboardingQrCode(identity: MerchantIdentity, input: { locationId: string; name: string; sourceType?: string; reference?: string }) {
    this.assertCanWrite(identity);
    const before = await this.onboardingState(identity);
    if (before.organization.onboardingStage !== "qr") {
      if (stageAfter(before.organization.onboardingStage, "qr") && before.qrCodes[0]) return before.qrCodes[0];
      throw new ConflictError("Customize your topics before creating the first QR code.", "ONBOARDING_STAGE_INVALID");
    }

    const base = slugify(input.name) || "qr";
    const sourceType = slugify(input.sourceType || "general") || "general";
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const publicToken = `${base}-${randomSuffix(5)}`;
      try {
        const qr = await this.repository.createOnboardingQrCode(identity.organizationId, {
          locationId: input.locationId,
          publicToken,
          name: input.name.trim(),
          sourceType,
          reference: input.reference?.trim() || null,
        });
        if (qr) return qr;

        const after = await this.onboardingState(identity);
        if (stageAfter(after.organization.onboardingStage, "qr") && after.qrCodes[0]) return after.qrCodes[0];
        throw new ConflictError("The onboarding QR step is no longer available.", "ONBOARDING_STAGE_INVALID");
      } catch (error) {
        if (hasDatabaseCode(error, "23505")) continue;
        if (hasDatabaseCode(error, "23514")) {
          throw new ConflictError("Your first location must be active before creating a QR code.", "LOCATION_INACTIVE");
        }
        throw error;
      }
    }
    throw new ConflictError("Could not allocate a unique QR token. Please try again.", "QR_TOKEN_CONFLICT");
  }

  async completeOnboarding(identity: MerchantIdentity) {
    this.assertCanWrite(identity);
    const current = await this.repository.getOrganizationProfile(identity.organizationId);
    if (!current) throw new NotFoundError("Organization not found.", "ORGANIZATION_NOT_FOUND");
    if (current.onboardingStage === "complete" && current.onboardingCompletedAt) return current;

    const completed = await this.repository.completeOnboarding(identity.organizationId);
    if (!completed) {
      throw new ConflictError("Create an active location and QR code before completing onboarding.", "ONBOARDING_NOT_READY");
    }
    return completed;
  }

  async dashboard(identity: MerchantIdentity, days = 30) {
    const safeDays = Math.min(90, Math.max(7, Math.floor(days)));
    const [summary, funnel, trend] = await Promise.all([
      this.repository.getDashboardSummary(identity.organizationId, safeDays),
      this.repository.getFunnel(identity.organizationId, safeDays),
      this.repository.getTrend(identity.organizationId, safeDays),
    ]);
    return { summary, funnel, trend, days: safeDays };
  }

  listLocations(identity: MerchantIdentity) {
    return this.repository.listLocations(identity.organizationId);
  }

  async createLocation(identity: MerchantIdentity, input: { name: string; subtitle?: string; googlePlaceId: string; publicId?: string }) {
    this.assertCanWrite(identity);
    const publicId = await this.resolveLocationPublicId(input.publicId, input.name);
    const googlePlaceId = input.googlePlaceId.trim();

    try {
      return await this.repository.createLocation(identity.organizationId, {
        publicId,
        name: input.name.trim(),
        subtitle: input.subtitle?.trim() || "Share your experience in a few taps.",
        googlePlaceId,
        googleReviewUrl: `https://search.google.com/local/writereview?placeid=${encodeURIComponent(googlePlaceId)}`,
        isActive: true,
      });
    } catch (error) {
      if (hasDatabaseCode(error, "23505")) {
        throw new ConflictError("That public location identifier was just taken. Please try again.", "LOCATION_PUBLIC_ID_TAKEN");
      }
      throw error;
    }
  }

  async updateLocation(identity: MerchantIdentity, locationId: string, input: { name?: string; subtitle?: string; googlePlaceId?: string; isActive?: boolean }) {
    this.assertCanWrite(identity);
    const patch: Partial<Omit<MerchantLocation, "id" | "createdAt">> = {};
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.subtitle !== undefined) patch.subtitle = input.subtitle.trim();
    if (input.googlePlaceId !== undefined) {
      const placeId = input.googlePlaceId.trim();
      patch.googlePlaceId = placeId;
      patch.googleReviewUrl = `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
    }
    if (input.isActive !== undefined) patch.isActive = input.isActive;

    const updated = await this.repository.updateLocation(identity.organizationId, locationId, patch);
    if (!updated) throw new NotFoundError("Location not found.", "LOCATION_NOT_FOUND");
    return updated;
  }

  listQrCodes(identity: MerchantIdentity) {
    return this.repository.listQrCodes(identity.organizationId);
  }

  async createQrCode(identity: MerchantIdentity, input: { locationId: string; name: string; sourceType?: string; reference?: string }) {
    this.assertCanWrite(identity);

    const initialLocation = await this.repository.getLocation(identity.organizationId, input.locationId);
    if (!initialLocation) throw new NotFoundError("Location not found.", "LOCATION_NOT_FOUND");
    if (!initialLocation.isActive) {
      throw new ConflictError("Activate the location before creating a QR code.", "LOCATION_INACTIVE");
    }

    const base = slugify(input.name) || "qr";
    const sourceType = slugify(input.sourceType || "generic") || "generic";

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const publicToken = `${base}-${randomSuffix(5)}`;
      try {
        return await this.repository.createQrCode(identity.organizationId, {
          locationId: input.locationId,
          publicToken,
          name: input.name.trim(),
          sourceType,
          reference: input.reference?.trim() || null,
        });
      } catch (error) {
        const currentLocation = await this.repository.getLocation(identity.organizationId, input.locationId);
        if (!currentLocation) throw new NotFoundError("Location not found.", "LOCATION_NOT_FOUND");
        if (!currentLocation.isActive || hasDatabaseCode(error, "23514")) {
          throw new ConflictError("Activate the location before creating a QR code.", "LOCATION_INACTIVE");
        }
        if (hasDatabaseCode(error, "23505")) continue;
        throw error;
      }
    }

    throw new ConflictError("Could not allocate a unique QR token. Please try again.", "QR_TOKEN_CONFLICT");
  }

  async updateQrCodeStatus(identity: MerchantIdentity, qrCodeId: string, isActive: boolean) {
    this.assertCanWrite(identity);

    const qrCode = await this.repository.getQrCode(identity.organizationId, qrCodeId);
    if (!qrCode) throw new NotFoundError("QR code not found.", "QR_CODE_NOT_FOUND");

    if (isActive) {
      const location = await this.repository.getLocation(identity.organizationId, qrCode.locationId);
      if (!location) throw new NotFoundError("Location not found.", "LOCATION_NOT_FOUND");
      if (!location.isActive) {
        throw new ConflictError("Activate the location before activating this QR code.", "LOCATION_INACTIVE");
      }
    }

    try {
      const updated = await this.repository.updateQrCodeStatus(identity.organizationId, qrCodeId, isActive);
      if (!updated) {
        if (isActive) {
          const location = await this.repository.getLocation(identity.organizationId, qrCode.locationId);
          if (location && !location.isActive) {
            throw new ConflictError("Activate the location before activating this QR code.", "LOCATION_INACTIVE");
          }
        }
        throw new NotFoundError("QR code not found.", "QR_CODE_NOT_FOUND");
      }
      return updated;
    } catch (error) {
      if (hasDatabaseCode(error, "23514")) {
        throw new ConflictError("Activate the location before activating this QR code.", "LOCATION_INACTIVE");
      }
      throw error;
    }
  }

  private async resolveLocationPublicId(requestedPublicId: string | undefined, name: string) {
    const base = slugify(requestedPublicId || name);
    if (base.length < 2) throw new ValidationError("A valid location identifier is required.");

    if (requestedPublicId) {
      if (!(await this.repository.isLocationPublicIdAvailable(base))) {
        throw new ConflictError("That public location identifier is already in use.", "LOCATION_PUBLIC_ID_TAKEN");
      }
      return base;
    }

    if (await this.repository.isLocationPublicIdAvailable(base)) return base;

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const candidate = `${base}-${randomSuffix(3)}`.slice(0, 80);
      if (await this.repository.isLocationPublicIdAvailable(candidate)) return candidate;
    }

    throw new ConflictError("Could not allocate a unique public location identifier. Please try again.", "LOCATION_PUBLIC_ID_CONFLICT");
  }

  private assertCanWrite(identity: MerchantIdentity) {
    if (!WRITE_ROLES.includes(identity.role)) throw new ForbiddenError();
  }
}
