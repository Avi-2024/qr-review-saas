import { getReviewService } from "@/server/bootstrap/review-container";
import { getClientIp, hashIp } from "@/server/http/request";
import { created, handleRouteError } from "@/server/http/response";
import { startSessionSchema } from "@/server/http/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = startSessionSchema.parse(await request.json());
    const result = await getReviewService().startSession({
      publicId: body.publicId,
      userAgent: request.headers.get("user-agent") ?? undefined,
      ipHash: hashIp(getClientIp(request)),
    });

    return created({
      sessionId: result.session.id,
      location: {
        publicId: result.location.publicId,
        name: result.location.name,
        googleReviewUrl: result.location.googleReviewUrl,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
