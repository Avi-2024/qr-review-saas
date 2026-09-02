import { clearMerchantSessionCookie, getMerchantSessionToken } from "@/server/auth/merchant-session";
import { getMerchantService } from "@/server/bootstrap/merchant-container";
import { handleRouteError, ok } from "@/server/http/response";

export const runtime = "nodejs";

export async function POST() {
  try {
    const token = await getMerchantSessionToken();
    if (token) await getMerchantService().logout(token);
    await clearMerchantSessionCookie();
    return ok({ loggedOut: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
