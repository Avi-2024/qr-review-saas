export interface QrPerformanceRow {
  qrCodeId: string;
  locationId: string;
  locationName: string;
  qrName: string;
  sourceType: string;
  reference: string | null;
  isActive: boolean;
  scans: number;
  reviewsGenerated: number;
  googleOpens: number;
  generationRate: number;
  conversionRate: number;
  googleFromGeneratedRate: number;
}

export interface QrAttributionSummary {
  scans: number;
  attributedScans: number;
  unattributedScans: number;
  attributionRate: number;
}

export interface QrPerformanceAnalytics {
  days: number;
  locationId: string | null;
  rows: QrPerformanceRow[];
  attribution: QrAttributionSummary;
  mostScanned: QrPerformanceRow | null;
  bestConverter: QrPerformanceRow | null;
  zeroActivityCount: number;
}
