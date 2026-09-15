import { RateLimitError } from "@/server/core/errors";
import { getMerchantLoginRateLimiter } from "@/server/bootstrap/merchant-container";
import { getMerchantSignupService } from "@/server/bootstrap/merchant-signup-container";
import { getEnv } from "@/server/config/env";
import { getClientIp, hashIp } from "@/server/http/request";
import { handleRouteError, created } from "@/server/http/response";
import { merchantSignupSchema } from "@/server/http/merchant-schemas";
import { setMerchantSessionCookie } from "@/server/auth/merchant-session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const decision = await getMerchantLoginRateLimiter().check(`merchant-signup:${ip}`);
    if (!decision.allowed) throw new RateLimitError("Too many signup attempts. Please try again shortly.");

    const body = merchantSignupSchema.parse(await request.json());
    const env = getEnv();
    const result = await getMerchantSignupService().signup({
      ...body,
      userAgent: request.headers.get("user-agent") ?? undefined,
      ipHash: hashIp(ip, env.IP_HASH_SECRET),
    });

    await setMerchantSessionCookie(result.token, result.expiresAt);
    return created({ identity: result.identity, trialDays: 7 });
  } catch (error) {
    return handleRouteError(error);
  }
}
