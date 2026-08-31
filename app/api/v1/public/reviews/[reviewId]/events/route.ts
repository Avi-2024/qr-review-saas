import { getReviewService } from "@/server/bootstrap/review-container";
import { handleRouteError, ok } from "@/server/http/response";
import { reviewEventSchema } from "@/server/http/schemas";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ reviewId: string }> },
) {
  try {
    const { reviewId } = await context.params;
    const body = reviewEventSchema.parse(await request.json());
    await getReviewService().recordDraftEvent({ draftId: reviewId, type: body.type });
    return ok({ recorded: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
