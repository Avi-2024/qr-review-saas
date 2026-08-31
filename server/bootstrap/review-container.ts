import { ReviewService } from "@/server/application/services/review-service";
import { getEnv } from "@/server/config/env";
import { getPool } from "@/server/infrastructure/database/pool";
import { MemoryReviewRepository } from "@/server/infrastructure/repositories/memory-review-repository";
import { PostgresReviewRepository } from "@/server/infrastructure/repositories/postgres-review-repository";
import { LocalReviewGenerator } from "@/server/infrastructure/review-generators/local-review-generator";
import { InMemoryRateLimiter } from "@/server/infrastructure/rate-limit/in-memory-rate-limiter";

const globalForReview = globalThis as typeof globalThis & {
  __reviewService?: ReviewService;
  __reviewRateLimiter?: InMemoryRateLimiter;
};

export function getReviewService() {
  if (globalForReview.__reviewService) return globalForReview.__reviewService;

  const env = getEnv();
  const usePostgres = env.REVIEW_REPOSITORY === "postgres" || Boolean(env.DATABASE_URL);
  const repository = usePostgres
    ? new PostgresReviewRepository(getPool())
    : new MemoryReviewRepository();

  globalForReview.__reviewService = new ReviewService(repository, new LocalReviewGenerator());
  return globalForReview.__reviewService;
}

export function getReviewRateLimiter() {
  if (globalForReview.__reviewRateLimiter) return globalForReview.__reviewRateLimiter;

  const env = getEnv();
  globalForReview.__reviewRateLimiter = new InMemoryRateLimiter(
    env.REVIEW_RATE_LIMIT_MAX,
    env.REVIEW_RATE_LIMIT_WINDOW_MS,
  );
  return globalForReview.__reviewRateLimiter;
}
