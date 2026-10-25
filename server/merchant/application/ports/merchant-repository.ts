import type {
  DashboardSummary,
  FunnelPoint,
  MerchantIdentity,
  MerchantLocation,
  MerchantOrganizationProfile,
  MerchantQrCode,
  MerchantTopicConfig,
  StandeeItem,
  TrendPoint,
} from "@/server/merchant/domain/merchant";

export interface MerchantRepository {
  findUserForLogin(email: string): Promise<(MerchantIdentity & { passwordHash: string }) | null>;
  createSession(input: { userId: string; organizationId: string; tokenHash: string; userAgent?: string; ipHash?: string; expiresAt: Date }): Promise<void>;
  getIdentityBySessionTokenHash(tokenHash: string): Promise<MerchantIdentity | null>;
  revokeSession(tokenHash: string): Promise<void>;
  touchSession(tokenHash: string): Promise<void>;

  getOrganizationProfile(organizationId: string): Promise<MerchantOrganizationProfile | null>;
  saveOnboardingBusiness(organizationId: string, input: { name: string; businessType: string }): Promise<MerchantOrganizationProfile | null>;
  createOnboardingLocation(organizationId: string, input: Omit<MerchantLocation, "id" | "createdAt">): Promise<MerchantLocation | null>;
  listLocationTopics(organizationId: string, locationId: string): Promise<MerchantTopicConfig[]>;
  replaceOnboardingTopics(organizationId: string, locationId: string, topics: Array<{ label: string; icon: string }>): Promise<MerchantTopicConfig[] | null>;
  createOnboardingQrCode(organizationId: string, input: { locationId: string; publicToken: string; name: string; sourceType: string; reference?: string | null }): Promise<MerchantQrCode | null>;
  completeOnboarding(organizationId: string): Promise<MerchantOrganizationProfile | null>;

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

  listStandees(organizationId: string): Promise<StandeeItem[]>;
  getStandeeByToken(publicToken: string): Promise<StandeeItem | null>;
  createStandeeBatch(organizationId: string, input: { count: number; prefix?: string; batchName?: string }): Promise<StandeeItem[]>;
  assignStandee(organizationId: string, input: { standeeId?: string; standeeCode?: string; locationId: string; notes?: string }): Promise<StandeeItem>;
  unbindStandee(organizationId: string, standeeId: string): Promise<StandeeItem>;
}
