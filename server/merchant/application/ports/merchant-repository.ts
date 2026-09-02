import type {
  DashboardSummary,
  FunnelPoint,
  MerchantIdentity,
  MerchantLocation,
  MerchantQrCode,
  TrendPoint,
} from "@/server/merchant/domain/merchant";

export interface MerchantRepository {
  findUserForLogin(email: string): Promise<(MerchantIdentity & { passwordHash: string }) | null>;
  createSession(input: { userId: string; organizationId: string; tokenHash: string; userAgent?: string; ipHash?: string; expiresAt: Date }): Promise<void>;
  getIdentityBySessionTokenHash(tokenHash: string): Promise<MerchantIdentity | null>;
  revokeSession(tokenHash: string): Promise<void>;
  touchSession(tokenHash: string): Promise<void>;

  getDashboardSummary(organizationId: string, days: number): Promise<DashboardSummary>;
  getFunnel(organizationId: string, days: number): Promise<FunnelPoint[]>;
  getTrend(organizationId: string, days: number): Promise<TrendPoint[]>;

  listLocations(organizationId: string): Promise<MerchantLocation[]>;
  getLocation(organizationId: string, locationId: string): Promise<MerchantLocation | null>;
  isLocationPublicIdAvailable(publicId: string): Promise<boolean>;
  createLocation(organizationId: string, input: Omit<MerchantLocation, "id" | "createdAt">): Promise<MerchantLocation>;
  updateLocation(organizationId: string, locationId: string, input: Partial<Omit<MerchantLocation, "id" | "createdAt">>): Promise<MerchantLocation | null>;

  listQrCodes(organizationId: string): Promise<MerchantQrCode[]>;
  getQrCode(organizationId: string, qrCodeId: string): Promise<MerchantQrCode | null>;
  createQrCode(organizationId: string, input: { locationId: string; publicToken: string; name: string; sourceType: string; reference?: string | null }): Promise<MerchantQrCode>;
  updateQrCodeStatus(organizationId: string, qrCodeId: string, isActive: boolean): Promise<MerchantQrCode | null>;
}
