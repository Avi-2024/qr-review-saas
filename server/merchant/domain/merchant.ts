export type MerchantRole = "owner" | "admin" | "manager" | "viewer";

export interface MerchantIdentity {
  userId: string;
  email: string;
  name: string;
  organizationId: string;
  organizationName: string;
  role: MerchantRole;
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
