import { requireMerchantApiIdentity } from "@/server/auth/merchant-session";
import { handleRouteError, ok } from "@/server/http/response";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { identity } = await requireMerchantApiIdentity();
    return ok({ identity });
  } catch (error) {
    return handleRouteError(error);
  }
}
