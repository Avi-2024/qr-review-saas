import { requireMerchantApiIdentity } from "@/server/auth/merchant-session";
import { getGooglePlacesClient, getGooglePlacesRateLimiter } from "@/server/bootstrap/google-places-container";
import { RateLimitError } from "@/server/core/errors";
import { handleRouteError, ok } from "@/server/http/response";
import { merchantGooglePlacesDetailsSchema } from "@/server/http/merchant-schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { identity } = await requireMerchantApiIdentity();
    const body = merchantGooglePlacesDetailsSchema.parse(await request.json());
    const decision = await getGooglePlacesRateLimiter().check(`user:${identity.userId}`);
    if (!decision.allowed) throw new RateLimitError("Too many Google business searches. Please try again shortly.");

    const place = await getGooglePlacesClient().details(body.placeId, body.sessionToken);
    return ok(
      { place },
      {
        headers: {
          "cache-control": "private, no-store",
          "x-ratelimit-remaining": String(decision.remaining),
        },
      },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
