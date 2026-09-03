import { getEnv } from "@/server/config/env";
import { getPool } from "@/server/infrastructure/database/pool";
import { QrPerformanceService } from "@/server/analytics/application/services/qr-performance-service";
import { PostgresQrPerformanceRepository } from "@/server/analytics/infrastructure/postgres-qr-performance-repository";

const globalForQrAnalytics = globalThis as typeof globalThis & {
  __qrPerformanceService?: QrPerformanceService;
};

export function getQrPerformanceService() {
  if (globalForQrAnalytics.__qrPerformanceService) return globalForQrAnalytics.__qrPerformanceService;
  const env = getEnv();
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for QR performance analytics.");
  }
  globalForQrAnalytics.__qrPerformanceService = new QrPerformanceService(
    new PostgresQrPerformanceRepository(getPool()),
  );
  return globalForQrAnalytics.__qrPerformanceService;
}
