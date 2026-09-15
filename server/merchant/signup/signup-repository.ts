import type { MerchantIdentity } from "@/server/merchant/domain/merchant";

export interface MerchantSignupRepository {
  createOwnerAccount(input: {
    email: string;
    passwordHash: string;
    name: string;
    businessName: string;
    tokenHash: string;
    expiresAt: Date;
    userAgent?: string;
    ipHash?: string;
  }): Promise<MerchantIdentity>;
}
