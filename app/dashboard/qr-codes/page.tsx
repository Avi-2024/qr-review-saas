export const dynamic = "force-dynamic";

import QrManager from "@/components/merchant/QrManager";
import { requireMerchantIdentity } from "@/server/auth/merchant-session";
import { getMerchantService } from "@/server/bootstrap/merchant-container";

export default async function QrCodesPage() {
  const identity = await requireMerchantIdentity();
  const [qrCodes, locations, standees] = await Promise.all([
    getMerchantService().listQrCodes(identity),
    getMerchantService().listLocations(identity),
    getMerchantService().listStandees(identity),
  ]);

  const activeStandees = standees.filter((s) => s.status === "assigned").length;
  const inStockStandees = standees.filter((s) => s.status === "unassigned").length;

  return (
    <>
      <header className="merchantTopbar">
        <div>
          <span className="merchantEyebrow">STANDEE INVENTORY &amp; QR CODES</span>
          <h1>Pre-Printed Standees &amp; QR Links</h1>
          <p>
            Manage pre-printed physical acrylic standees, batch generate new inventory for market visits, and activate
            touchpoints on the spot.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <span className="merchantPill" style={{ background: "#ecfdf5", color: "#065f46" }}>
            {inStockStandees} in stock
          </span>
          <span className="merchantPill">{activeStandees} deployed</span>
        </div>
      </header>
      <QrManager qrCodes={qrCodes} locations={locations} standees={standees} role={identity.role} />
    </>
  );
}
