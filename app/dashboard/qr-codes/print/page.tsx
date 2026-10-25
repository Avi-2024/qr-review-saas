export const dynamic = "force-dynamic";

import QRCode from "qrcode";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import BulkPrintStudio, { type PrintableStandee } from "@/components/merchant/BulkPrintStudio";
import { requireMerchantIdentity } from "@/server/auth/merchant-session";
import { getMerchantService } from "@/server/bootstrap/merchant-container";

export default async function BulkPrintPage(props: {
  searchParams?: Promise<{ filter?: string; batch?: string }>;
}) {
  const identity = await requireMerchantIdentity().catch(() => null);
  if (!identity) {
    redirect("/login");
  }

  const searchParams = props.searchParams ? await props.searchParams : {};
  const filter = (searchParams.filter === "all" || searchParams.filter === "assigned")
    ? searchParams.filter
    : "unassigned";

  const standees = await getMerchantService().listStandees(identity);

  // Determine origin for QR codes
  const headerList = await headers();
  const host = headerList.get("host") || "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;

  // Pre-generate QR Data URLs on the server for instant vector printing without network lag
  const printableStandees: PrintableStandee[] = await Promise.all(
    standees.map(async (st) => {
      const destination = `${origin}/r/${encodeURIComponent(st.publicToken)}`;
      const qrDataUrl = await QRCode.toDataURL(destination, {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 480,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      });

      return {
        id: st.id,
        standeeCode: st.standeeCode,
        publicToken: st.publicToken,
        status: st.status,
        locationName: st.locationName,
        batchName: st.batchName,
        qrDataUrl,
      };
    }),
  );

  return (
    <BulkPrintStudio
      standees={printableStandees}
      initialFilter={filter}
    />
  );
}