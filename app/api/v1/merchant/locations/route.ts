import { requireMerchantApiIdentity } from "@/server/auth/merchant-session";
import { getBillingService } from "@/server/bootstrap/billing-container";
import { getMerchantService } from "@/server/bootstrap/merchant-container";
import { handleRouteError, created, ok } from "@/server/http/response";
import { merchantLocationCreateSchema } from "@/server/http/merchant-schemas";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { identity } = await requireMerchantApiIdentity();
    return ok({ locations: await getMerchantService().listLocations(identity) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { identity } = await requireMerchantApiIdentity();
    const body = merchantLocationCreateSchema.parse(await request.json());
    await getBillingService().assertLocationCapacity(identity.organizationId);
    const location = await getMerchantService().createLocation(identity, body);
    if (body.standeeId || body.standeeCode) {
      try {
        await getMerchantService().assignStandee(identity, {
          standeeId: body.standeeId,
          standeeCode: body.standeeCode,
          locationId: location.id,
          notes: `Assigned during onboarding for ${location.name}`,
        });
      } catch (assignError) {
        // Fallback to digital QR if standee binding encounters an issue
        try {
          await getMerchantService().createQrCode(identity, {
            locationId: location.id,
            name: `${location.name} QR`,
            sourceType: "general",
          });
        } catch {
          // Continue even if touchpoint was already created
        }
      }
    } else {
      try {
        await getMerchantService().createQrCode(identity, {
          locationId: location.id,
          name: `${location.name} QR`,
          sourceType: "general",
        });
      } catch {
        // Continue even if initial touchpoint was already created
      }
    }
    return created({ location });
  } catch (error) {
    return handleRouteError(error);
  }
}
