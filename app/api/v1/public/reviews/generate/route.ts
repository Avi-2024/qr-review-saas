import { getGenerateRateLimiter, getReviewService } from "@/server/bootstrap/review-container";
import { RateLimitError } from "@/server/core/errors";
import { getClientIp } from "@/server/http/request";
import { handleRouteError, ok } from "@/server/http/response";
import { generateReviewSchema } from "@/server/http/schemas";
import type { Rating } from "@/server/domain/review";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const decision = getGenerateRateLimiter().check(`generate:${ip}`);
    if (!decision.allowed) throw new RateLimitError();

    const body = generateReviewSchema.parse(await request.json());
    const result = await getReviewService().generate({
      sessionId: body.sessionId,
      requestId: body.requestId,
      rating: body.rating as Rating,
      topicIds: body.topicIds,
      note: body.note,
      variation: body.variation,
    });

    return ok(
      {
        draftId: result.draft.id,
        text: result.draft.text,
        provider: result.draft.provider,
        googleReviewUrl: result.location.googleReviewUrl,
        replayed: result.replayed,
      },
      {
        headers: {
          "x-ratelimit-remaining": String(decision.remaining),
          "x-idempotent-replay": String(result.replayed),
          "cache-control": "no-store",
        },
      },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
