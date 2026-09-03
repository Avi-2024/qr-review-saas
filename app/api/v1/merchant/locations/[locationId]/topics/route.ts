import { requireMerchantApiIdentity } from "@/server/auth/merchant-session";
import { getMerchantTopicService } from "@/server/bootstrap/merchant-topic-container";
import { handleRouteError, ok } from "@/server/http/response";
import { merchantLocationIdSchema, merchantTopicSaveSchema } from "@/server/http/merchant-schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ locationId: string }> },
) {
  try {
    const { identity } = await requireMerchantApiIdentity();
    const params = await context.params;
    const locationId = merchantLocationIdSchema.parse(params.locationId);
    const topics = await getMerchantTopicService().list(identity, locationId);
    return ok({ topics }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ locationId: string }> },
) {
  try {
    const { identity } = await requireMerchantApiIdentity();
    const params = await context.params;
    const locationId = merchantLocationIdSchema.parse(params.locationId);
    const body = merchantTopicSaveSchema.parse(await request.json());
    const topics = await getMerchantTopicService().save(identity, locationId, body.topics);
    return ok({ topics });
  } catch (error) {
    return handleRouteError(error);
  }
}
