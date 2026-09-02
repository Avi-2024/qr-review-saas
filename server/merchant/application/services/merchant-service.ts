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
import type { MerchantIdentity, MerchantLocation, MerchantRole } from "@/server/merchant/domain/merchant";
import { createSessionToken, hashSessionToken } from "@/server/auth/session-token";

const WRITE_ROLES: MerchantRole[] = ["owner", "admin", "manager"];

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
}

function randomSuffix(bytes = 4) {
  return randomBytes(bytes).toString("base64url").toLowerCase();
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

    return this.repository.createLocation(identity.organizationId, {
      publicId,
      name: input.name.trim(),
      subtitle: input.subtitle?.trim() || "Fast feedback. No login required.",
      googlePlaceId,
      googleReviewUrl: `https://search.google.com/local/writereview?placeid=${encodeURIComponent(googlePlaceId)}`,
      isActive: true,
    });
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

    const location = await this.repository.getLocation(identity.organizationId, input.locationId);
    if (!location) throw new NotFoundError("Location not found.", "LOCATION_NOT_FOUND");
    if (!location.isActive) {
      throw new ConflictError("Activate the location before creating a QR code.", "LOCATION_INACTIVE");
    }

    const base = slugify(input.name) || "qr";
    const publicToken = `${base}-${randomSuffix(5)}`;
    return this.repository.createQrCode(identity.organizationId, {
      locationId: input.locationId,
      publicToken,
      name: input.name.trim(),
      sourceType: slugify(input.sourceType || "generic") || "generic",
      reference: input.reference?.trim() || null,
    });
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

    const updated = await this.repository.updateQrCodeStatus(identity.organizationId, qrCodeId, isActive);
    if (!updated) throw new NotFoundError("QR code not found.", "QR_CODE_NOT_FOUND");
    return updated;
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

    // Bounded attempts avoid an unbounded retry loop while making auto-generated IDs collision-safe.
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
