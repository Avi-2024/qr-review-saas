import { requireMerchantApiIdentity } from "@/server/auth/merchant-session";
import { getGooglePlacesClient, getGooglePlacesRateLimiter } from "@/server/bootstrap/google-places-container";
import { RateLimitError } from "@/server/core/errors";
import { handleRouteError, ok } from "@/server/http/response";
import { merchantGooglePlacesAutocompleteSchema } from "@/server/http/merchant-schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { identity } = await requireMerchantApiIdentity();
    const body = merchantGooglePlacesAutocompleteSchema.parse(await request.json());
    const decision = await getGooglePlacesRateLimiter().check(`user:${identity.userId}`);
    if (!decision.allowed) throw new RateLimitError("Too many Google business searches. Please try again shortly.");

    const predictions = await getGooglePlacesClient().autocomplete(body.input, body.sessionToken);
    return ok(
      { predictions },
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
