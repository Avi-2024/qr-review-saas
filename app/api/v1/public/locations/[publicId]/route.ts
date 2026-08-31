import { getReviewService } from "@/server/bootstrap/review-container";
import { handleRouteError, ok } from "@/server/http/response";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ publicId: string }> },
) {
  try {
    const { publicId } = await context.params;
    const location = await getReviewService().getLocation(publicId);
    return ok({
      publicId: location.publicId,
      name: location.name,
      subtitle: location.subtitle,
      googleReviewUrl: location.googleReviewUrl,
      topics: location.topics,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
