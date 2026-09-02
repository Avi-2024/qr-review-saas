import { ReviewService } from "@/server/application/services/review-service";
import { getEnv } from "@/server/config/env";
import { getPool } from "@/server/infrastructure/database/pool";
import { createConfiguredRateLimiter } from "@/server/infrastructure/rate-limit/configured-rate-limiter";
import type { RateLimiter } from "@/server/infrastructure/rate-limit/rate-limiter";
import { MemoryReviewRepository } from "@/server/infrastructure/repositories/memory-review-repository";
import { PostgresReviewRepository } from "@/server/infrastructure/repositories/postgres-review-repository";
import { LocalReviewGenerator } from "@/server/infrastructure/review-generators/local-review-generator";

const globalForReview = globalThis as typeof globalThis & {
  __reviewService?: ReviewService;
  __reviewSessionRateLimiter?: RateLimiter;
  __reviewGenerateRateLimiter?: RateLimiter;
  __reviewEventRateLimiter?: RateLimiter;
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
  globalForReview.__reviewSessionRateLimiter = createConfiguredRateLimiter(
    "review-session",
    env.REVIEW_SESSION_RATE_LIMIT_MAX,
    env.REVIEW_RATE_LIMIT_WINDOW_MS,
  );
  return globalForReview.__reviewSessionRateLimiter;
}

export function getGenerateRateLimiter() {
  if (globalForReview.__reviewGenerateRateLimiter) return globalForReview.__reviewGenerateRateLimiter;
  const env = getEnv();
  globalForReview.__reviewGenerateRateLimiter = createConfiguredRateLimiter(
    "review-generate",
    env.REVIEW_GENERATE_RATE_LIMIT_MAX,
    env.REVIEW_RATE_LIMIT_WINDOW_MS,
  );
  return globalForReview.__reviewGenerateRateLimiter;
}

export function getEventRateLimiter() {
  if (globalForReview.__reviewEventRateLimiter) return globalForReview.__reviewEventRateLimiter;
  const env = getEnv();
  globalForReview.__reviewEventRateLimiter = createConfiguredRateLimiter(
    "review-event",
    env.REVIEW_EVENT_RATE_LIMIT_MAX,
    env.REVIEW_RATE_LIMIT_WINDOW_MS,
  );
  return globalForReview.__reviewEventRateLimiter;
}
