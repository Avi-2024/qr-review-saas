import { RateLimitError } from "@/server/core/errors";
import { getReviewRateLimiter, getReviewService } from "@/server/bootstrap/review-container";
import { getClientIp } from "@/server/http/request";
import { handleRouteError, ok } from "@/server/http/response";
import { generateReviewSchema } from "@/server/http/schemas";
import type { Rating } from "@/server/domain/review";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const decision = getReviewRateLimiter().check(`generate:${ip}`);
    if (!decision.allowed) throw new RateLimitError();

    const body = generateReviewSchema.parse(await request.json());
    const result = await getReviewService().generate({
      sessionId: body.sessionId,
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
      },
      {
        headers: {
          "x-ratelimit-remaining": String(decision.remaining),
          "cache-control": "no-store",
        },
      },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
