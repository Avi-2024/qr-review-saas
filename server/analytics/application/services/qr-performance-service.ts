import { z } from "zod";
import type { QrPerformanceRepository } from "@/server/analytics/application/ports/qr-performance-repository";
import type { MerchantIdentity } from "@/server/merchant/domain/merchant";

const uuidSchema = z.string().uuid();
const MIN_CONVERSION_SAMPLE = 5;

export class QrPerformanceService {
  constructor(private readonly repository: QrPerformanceRepository) {}

  async getAnalytics(identity: MerchantIdentity, input: { days?: number; locationId?: string | null } = {}) {
    const days = Math.min(90, Math.max(7, Math.floor(input.days ?? 30)));
    const locationId = input.locationId && uuidSchema.safeParse(input.locationId).success ? input.locationId : null;
    const [rows, attribution] = await Promise.all([
      this.repository.listQrPerformance({ organizationId: identity.organizationId, days, locationId }),
      this.repository.getAttributionSummary({ organizationId: identity.organizationId, days }),
    ]);

    const mostScanned = rows.reduce<(typeof rows)[number] | null>((best, row) => {
      if (!best || row.scans > best.scans || (row.scans === best.scans && row.googleOpens > best.googleOpens)) return row;
      return best;
    }, null);

    const bestConverter = rows
      .filter((row) => row.scans >= MIN_CONVERSION_SAMPLE)
      .reduce<(typeof rows)[number] | null>((best, row) => {
        if (!best || row.conversionRate > best.conversionRate || (row.conversionRate === best.conversionRate && row.scans > best.scans)) return row;
        return best;
      }, null);

    return {
      days,
      locationId,
      rows,
      attribution,
      mostScanned: mostScanned && mostScanned.scans > 0 ? mostScanned : null,
      bestConverter,
      zeroActivityCount: rows.filter((row) => row.scans === 0).length,
      minimumConversionSample: MIN_CONVERSION_SAMPLE,
    };
  }
}
