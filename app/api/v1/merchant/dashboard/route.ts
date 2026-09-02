import { requireMerchantApiIdentity } from "@/server/auth/merchant-session";
import { getMerchantService } from "@/server/bootstrap/merchant-container";
import { handleRouteError, ok } from "@/server/http/response";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { identity } = await requireMerchantApiIdentity();
    const url = new URL(request.url);
    const days = Number(url.searchParams.get("days") || 30);
    return ok(await getMerchantService().dashboard(identity, days));
  } catch (error) {
    return handleRouteError(error);
  }
}
