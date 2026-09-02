import { RateLimitError } from "@/server/core/errors";
import { getMerchantLoginRateLimiter, getMerchantService } from "@/server/bootstrap/merchant-container";
import { getEnv } from "@/server/config/env";
import { getClientIp, hashIp } from "@/server/http/request";
import { handleRouteError, ok } from "@/server/http/response";
import { merchantLoginSchema } from "@/server/http/merchant-schemas";
import { setMerchantSessionCookie } from "@/server/auth/merchant-session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const decision = getMerchantLoginRateLimiter().check(`merchant-login:${ip}`);
    if (!decision.allowed) throw new RateLimitError("Too many sign-in attempts. Please try again shortly.");

    const body = merchantLoginSchema.parse(await request.json());
    const env = getEnv();
    const result = await getMerchantService().login({
      email: body.email,
      password: body.password,
      userAgent: request.headers.get("user-agent") ?? undefined,
      ipHash: hashIp(ip, env.IP_HASH_SECRET),
    });

    await setMerchantSessionCookie(result.token, result.expiresAt);
    return ok({ identity: result.identity }, { headers: { "x-ratelimit-remaining": String(decision.remaining) } });
  } catch (error) {
    return handleRouteError(error);
  }
}
