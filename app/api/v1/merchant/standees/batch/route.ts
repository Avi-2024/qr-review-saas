import { requireMerchantApiIdentity } from "@/server/auth/merchant-session";
import { getMerchantService } from "@/server/bootstrap/merchant-container";
import { standeeBatchCreateSchema } from "@/server/http/merchant-schemas";
import { created, handleRouteError } from "@/server/http/response";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { identity } = await requireMerchantApiIdentity();
    const body = standeeBatchCreateSchema.parse(await request.json().catch(() => ({})));
    const standees = await getMerchantService().createStandeeBatch(identity, body);
    return created({ standees });
  } catch (error) {
    return handleRouteError(error);
  }
}
