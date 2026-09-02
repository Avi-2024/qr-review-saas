export type MerchantRole = "owner" | "admin" | "manager" | "viewer";
export type MerchantOnboardingStage = "business" | "location" | "topics" | "qr" | "ready" | "complete";

export interface MerchantIdentity {
  userId: string;
  email: string;
  name: string;
  organizationId: string;
  organizationName: string;
  businessType: string | null;
  onboardingStage: MerchantOnboardingStage;
  onboardingCompletedAt: Date | null;
  role: MerchantRole;
}

export interface MerchantOrganizationProfile {
  id: string;
  name: string;
  businessType: string | null;
  onboardingStage: MerchantOnboardingStage;
  onboardingCompletedAt: Date | null;
}

export interface MerchantLocation {
  id: string;
  publicId: string;
  name: string;
  subtitle: string;
  googlePlaceId: string;
  googleReviewUrl: string;
  isActive: boolean;
  createdAt: Date;
}

export interface MerchantTopicConfig {
  id: string;
  label: string;
  icon: string;
  sortOrder: number;
  isActive: boolean;
}

export interface MerchantQrCode {
  id: string;
  locationId: string;
  locationName: string;
  publicToken: string;
  name: string;
  sourceType: string;
  reference: string | null;
  isActive: boolean;
  createdAt: Date;
}

export interface MerchantOnboardingState {
  organization: MerchantOrganizationProfile;
  locations: MerchantLocation[];
  topics: MerchantTopicConfig[];
  qrCodes: MerchantQrCode[];
}

export interface DashboardSummary {
  locations: number;
  qrCodes: number;
  scans: number;
  reviewsGenerated: number;
  googleOpens: number;
  conversionRate: number;
}

export interface FunnelPoint {
  event: string;
  value: number;
}

export interface TrendPoint {
  date: string;
  scans: number;
  generated: number;
  googleOpens: number;
}
