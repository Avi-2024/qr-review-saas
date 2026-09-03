import type { QrAttributionSummary, QrPerformanceRow } from "@/server/analytics/domain/qr-performance";

export interface QrPerformanceRepository {
  listQrPerformance(input: { organizationId: string; days: number; locationId?: string | null }): Promise<QrPerformanceRow[]>;
  getAttributionSummary(input: { organizationId: string; days: number }): Promise<QrAttributionSummary>;
}
