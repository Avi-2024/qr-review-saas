import { getReviewService, getSessionRateLimiter } from "@/server/bootstrap/review-container";
import { getEnv } from "@/server/config/env";
import { RateLimitError } from "@/server/core/errors";
import { getClientIp, hashIp } from "@/server/http/request";
import { created, handleRouteError, ok } from "@/server/http/response";
import { startSessionSchema } from "@/server/http/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const decision = getSessionRateLimiter().check(`session:${ip}`);
    if (!decision.allowed) throw new RateLimitError();

    const body = startSessionSchema.parse(await request.json());
    const env = getEnv();
    const result = await getReviewService().startSession({
      qrToken: body.qrToken,
      clientSessionId: body.clientSessionId,
      userAgent: request.headers.get("user-agent") ?? undefined,
      ipHash: hashIp(ip, env.IP_HASH_SECRET),
    });

    const payload = {
      sessionId: result.session.id,
      expiresAt: result.session.expiresAt,
      qr: {
        token: result.qr.publicToken,
        name: result.qr.name,
      },
      location: {
        publicId: result.location.publicId,
        name: result.location.name,
        subtitle: result.location.subtitle,
        googleReviewUrl: result.location.googleReviewUrl,
        topics: result.location.topics,
      },
    };

    return result.created ? created(payload) : ok(payload);
  } catch (error) {
    return handleRouteError(error);
  }
}
