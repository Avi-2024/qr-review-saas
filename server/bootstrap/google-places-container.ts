import { AppError } from "@/server/core/errors";
import { getEnv } from "@/server/config/env";
import { createConfiguredRateLimiter } from "@/server/infrastructure/rate-limit/configured-rate-limiter";
import type { RateLimiter } from "@/server/infrastructure/rate-limit/rate-limiter";
import { GooglePlacesClient } from "@/server/integrations/google-places/google-places-client";

const globalForGooglePlaces = globalThis as typeof globalThis & {
  __googlePlacesClient?: GooglePlacesClient;
  __googlePlacesLimiter?: RateLimiter;
};

export function isGooglePlacesConfigured() {
  return Boolean(getEnv().GOOGLE_PLACES_API_KEY);
}

export function getGooglePlacesClient() {
  if (globalForGooglePlaces.__googlePlacesClient) return globalForGooglePlaces.__googlePlacesClient;
  const env = getEnv();
  if (!env.GOOGLE_PLACES_API_KEY) {
    throw new AppError(
      "Google business search is not configured. Use the manual Place ID option or configure GOOGLE_PLACES_API_KEY.",
      503,
      "GOOGLE_PLACES_NOT_CONFIGURED",
    );
  }

  globalForGooglePlaces.__googlePlacesClient = new GooglePlacesClient(
    env.GOOGLE_PLACES_API_KEY,
    env.GOOGLE_PLACES_REQUEST_TIMEOUT_MS,
  );
  return globalForGooglePlaces.__googlePlacesClient;
}

export function getGooglePlacesRateLimiter() {
  if (globalForGooglePlaces.__googlePlacesLimiter) return globalForGooglePlaces.__googlePlacesLimiter;
  const env = getEnv();
  globalForGooglePlaces.__googlePlacesLimiter = createConfiguredRateLimiter(
    "merchant-google-places",
    env.GOOGLE_PLACES_RATE_LIMIT_MAX,
    env.REVIEW_RATE_LIMIT_WINDOW_MS,
  );
  return globalForGooglePlaces.__googlePlacesLimiter;
}
