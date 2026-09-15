import bcrypt from "bcryptjs";
import { ConflictError, ValidationError } from "@/server/core/errors";
import { createSessionToken, hashSessionToken } from "@/server/auth/session-token";
import type { MerchantSignupRepository } from "@/server/merchant/signup/signup-repository";

function hasDatabaseCode(error: unknown, code: string) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === code;
}

export class MerchantSignupService {
  constructor(
    private readonly repository: MerchantSignupRepository,
    private readonly sessionTtlHours: number,
  ) {}

  async signup(input: {
    email: string;
    password: string;
    name: string;
    businessName: string;
    userAgent?: string;
    ipHash?: string;
  }) {
    const email = input.email.trim().toLowerCase();
    const name = input.name.trim();
    const businessName = input.businessName.trim();
    if (input.password.length < 12) {
      throw new ValidationError("Password must be at least 12 characters.");
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const token = createSessionToken();
    const expiresAt = new Date(Date.now() + this.sessionTtlHours * 60 * 60 * 1000);

    try {
      const identity = await this.repository.createOwnerAccount({
        email,
        passwordHash,
        name,
        businessName,
        tokenHash: hashSessionToken(token),
        expiresAt,
        userAgent: input.userAgent,
        ipHash: input.ipHash,
      });
      return { token, expiresAt, identity };
    } catch (error) {
      if (hasDatabaseCode(error, "23505")) {
        throw new ConflictError("An account with this email already exists.", "MERCHANT_EMAIL_EXISTS");
      }
      throw error;
    }
  }
}
