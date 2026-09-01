import { getEventRateLimiter, getReviewService } from "@/server/bootstrap/review-container";
import { RateLimitError } from "@/server/core/errors";
import { getClientIp } from "@/server/http/request";
import { handleRouteError, ok } from "@/server/http/response";
import { sessionEventSchema } from "@/server/http/schemas";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  try {
    const ip = getClientIp(request);
    const decision = getEventRateLimiter().check(`session-event:${ip}`);
    if (!decision.allowed) throw new RateLimitError();

    const { sessionId } = await context.params;
    const body = sessionEventSchema.parse(await request.json());

    const metadata = body.type === "RATING_SELECTED"
      ? { rating: body.rating }
      : body.type === "TOPIC_SELECTED"
        ? { topicId: body.topicId, selected: body.selected }
        : undefined;

    await getReviewService().recordSessionEvent({
      sessionId,
      type: body.type,
      clientEventId: body.eventId,
      metadata,
    });

    return ok({ recorded: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
