import QRCode from "qrcode";
import { NotFoundError } from "@/server/core/errors";
import { requireMerchantApiIdentity } from "@/server/auth/merchant-session";
import { getMerchantService } from "@/server/bootstrap/merchant-container";
import { handleRouteError } from "@/server/http/response";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ standeeId: string }> },
) {
  try {
    const { identity } = await requireMerchantApiIdentity();
    const { standeeId } = await context.params;
    const standees = await getMerchantService().listStandees(identity);
    const standee = standees.find((item) => item.id === standeeId || item.publicToken === standeeId);
    if (!standee) throw new NotFoundError("Standee not found.", "STANDEE_NOT_FOUND");

    const origin = new URL(request.url).origin;
    const destination = `${origin}/r/${encodeURIComponent(standee.publicToken)}`;
    const svg = await QRCode.toString(destination, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 2,
      width: 640,
    });
    const download = new URL(request.url).searchParams.get("download") === "1";

    return new Response(svg, {
      status: 200,
      headers: {
        "content-type": "image/svg+xml; charset=utf-8",
        "cache-control": "private, max-age=300",
        "content-disposition": `${download ? "attachment" : "inline"}; filename="${standee.standeeCode}.svg"`,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
