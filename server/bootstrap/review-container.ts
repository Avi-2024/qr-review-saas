import { ReviewService } from "@/server/application/services/review-service";
import { getEnv } from "@/server/config/env";
import { getPool } from "@/server/infrastructure/database/pool";
import { MemoryReviewRepository } from "@/server/infrastructure/repositories/memory-review-repository";
import { PostgresReviewRepository } from "@/server/infrastructure/repositories/postgres-review-repository";
import { LocalReviewGenerator } from "@/server/infrastructure/review-generators/local-review-generator";
import { InMemoryRateLimiter } from "@/server/infrastructure/rate-limit/in-memory-rate-limiter";

const globalForReview = globalThis as typeof globalThis & {
  __reviewService?: ReviewService;
  __reviewSessionRateLimiter?: InMemoryRateLimiter;
  __reviewGenerateRateLimiter?: InMemoryRateLimiter;
  __reviewEventRateLimiter?: InMemoryRateLimiter;
};

export function getReviewService() {
  if (globalForReview.__reviewService) return globalForReview.__reviewService;

  const env = getEnv();
  const repositoryMode = env.REVIEW_REPOSITORY ?? "memory";
  const repository = repositoryMode === "postgres"
    ? new PostgresReviewRepository(getPool())
    : new MemoryReviewRepository();

  globalForReview.__reviewService = new ReviewService(
    repository,
    new LocalReviewGenerator(),
    env.REVIEW_SESSION_TTL_MINUTES,
  );

  return globalForReview.__reviewService;
}

export function getSessionRateLimiter() {
  if (globalForReview.__reviewSessionRateLimiter) return globalForReview.__reviewSessionRateLimiter;
  const env = getEnv();
  globalForReview.__reviewSessionRateLimiter = new InMemoryRateLimiter(
    env.REVIEW_SESSION_RATE_LIMIT_MAX,
    env.REVIEW_RATE_LIMIT_WINDOW_MS,
  );
  return globalForReview.__reviewSessionRateLimiter;
}

export function getGenerateRateLimiter() {
  if (globalForReview.__reviewGenerateRateLimiter) return globalForReview.__reviewGenerateRateLimiter;
  const env = getEnv();
  globalForReview.__reviewGenerateRateLimiter = new InMemoryRateLimiter(
    env.REVIEW_GENERATE_RATE_LIMIT_MAX,
    env.REVIEW_RATE_LIMIT_WINDOW_MS,
  );
  return globalForReview.__reviewGenerateRateLimiter;
}

export function getEventRateLimiter() {
  if (globalForReview.__reviewEventRateLimiter) return globalForReview.__reviewEventRateLimiter;
  const env = getEnv();
  globalForReview.__reviewEventRateLimiter = new InMemoryRateLimiter(
    env.REVIEW_EVENT_RATE_LIMIT_MAX,
    env.REVIEW_RATE_LIMIT_WINDOW_MS,
  );
  return globalForReview.__reviewEventRateLimiter;
}
