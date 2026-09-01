import { getReviewService } from "@/server/bootstrap/review-container";
import { handleRouteError, ok } from "@/server/http/response";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    const { qr, location } = await getReviewService().getPublicReviewConfig(token);

    return ok({
      qr: {
        token: qr.publicToken,
        name: qr.name,
        sourceType: qr.sourceType,
        reference: qr.reference,
      },
      location: {
        publicId: location.publicId,
        name: location.name,
        subtitle: location.subtitle,
        googleReviewUrl: location.googleReviewUrl,
        topics: location.topics,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
