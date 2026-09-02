import { getEventRateLimiter, getReviewService } from "@/server/bootstrap/review-container";
import { RateLimitError } from "@/server/core/errors";
import { getClientIp } from "@/server/http/request";
import { handleRouteError, ok } from "@/server/http/response";
import { reviewEventSchema } from "@/server/http/schemas";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ reviewId: string }> },
) {
  try {
    const ip = getClientIp(request);
    const decision = await getEventRateLimiter().check(`draft-event:${ip}`);
    if (!decision.allowed) throw new RateLimitError();

    const { reviewId } = await context.params;
    const body = reviewEventSchema.parse(await request.json());
    await getReviewService().recordDraftEvent({
      draftId: reviewId,
      type: body.type,
      clientEventId: body.eventId,
    });
    return ok({ recorded: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
