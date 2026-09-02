"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { MerchantLocation, MerchantQrCode, MerchantRole } from "@/server/merchant/domain/merchant";

export default function QrManager({
  qrCodes,
  locations,
  role,
}: {
  qrCodes: MerchantQrCode[];
  locations: MerchantLocation[];
  role: MerchantRole;
}) {
  const router = useRouter();
  const canWrite = role !== "viewer";
  const activeLocations = useMemo(() => locations.filter((item) => item.isActive), [locations]);
  const [locationId, setLocationId] = useState(activeLocations[0]?.id ?? "");
  const [name, setName] = useState("");
  const [sourceType, setSourceType] = useState("counter");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  async function createQr(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/v1/merchant/qr-codes", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ locationId, name, sourceType, reference: reference || undefined }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error?.message || "Could not create QR code.");
      setName(""); setReference(""); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create QR code."); }
    finally { setLoading(false); }
  }

  async function toggle(qr: MerchantQrCode) {
    const response = await fetch(`/api/v1/merchant/qr-codes/${qr.id}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: !qr.isActive }),
    });
    const body = await response.json();
    if (!response.ok || !body.success) { setError(body.error?.message || "Could not update QR code."); return; }
    router.refresh();
  }

  async function copyLink(qr: MerchantQrCode) {
    const link = `${window.location.origin}/r/${qr.publicToken}`;
    await navigator.clipboard.writeText(link);
    setCopied(qr.id);
    window.setTimeout(() => setCopied((value) => value === qr.id ? null : value), 1400);
  }

  return (
    <>
      {canWrite ? (
        <form className="merchantCard merchantFormCard" onSubmit={createQr}>
          <span className="merchantEyebrow">CREATE QR TOUCHPOINT</span><h2>Add a measurable customer entry point</h2><p>Create separate QR assets for billing counters, reception, tables, packaging or any offline touchpoint you want to measure independently.</p>
          <div className="merchantFormGrid">
            <div className="merchantField"><label>Location</label><select value={locationId} onChange={(e)=>setLocationId(e.target.value)} required><option value="">Select location</option>{activeLocations.map((location)=><option key={location.id} value={location.id}>{location.name}</option>)}</select></div>
            <div className="merchantField"><label>QR name</label><input value={name} onChange={(e)=>setName(e.target.value)} placeholder="e.g. Billing Counter" required /></div>
            <div className="merchantField"><label>Source type</label><select value={sourceType} onChange={(e)=>setSourceType(e.target.value)}><option value="counter">Counter</option><option value="reception">Reception</option><option value="table">Table</option><option value="packaging">Packaging</option><option value="poster">Poster</option><option value="generic">Generic</option></select></div>
            <div className="merchantField"><label>Reference (optional)</label><input value={reference} onChange={(e)=>setReference(e.target.value)} placeholder="e.g. counter-01" /></div>
          </div>
          {error ? <div className="merchantError">{error}</div> : null}
          <div className="merchantFormActions"><button className="merchantBtn" disabled={loading || !locationId}>{loading ? "Creating…" : "Create QR code"}</button></div>
        </form>
      ) : null}

      <section className="merchantCard merchantTableCard">
        <div className="merchantTableHead"><h2>QR touchpoints</h2><span className="merchantPill">{qrCodes.length} total</span></div>
        {qrCodes.length ? (
          <table className="merchantTable"><thead><tr><th>QR</th><th>Location</th><th>Public route</th><th>Status</th><th>Actions</th></tr></thead><tbody>
            {qrCodes.map((qr) => <tr key={qr.id}>
              <td><strong>{qr.name}</strong><small>{qr.sourceType}{qr.reference ? ` · ${qr.reference}` : ""}</small></td>
              <td><strong>{qr.locationName}</strong></td>
              <td><span className="merchantQrLink">/r/{qr.publicToken}</span></td>
              <td><span className={`merchantStatus ${qr.isActive ? "" : "off"}`}>{qr.isActive ? "Active" : "Paused"}</span></td>
              <td><div className="merchantActions">
                <button onClick={()=>void copyLink(qr)}>{copied === qr.id ? "Copied" : "Copy link"}</button>
                <button onClick={()=>window.open(`/api/v1/merchant/qr-codes/${qr.id}/svg`,"_blank")}>View QR</button>
                <button onClick={()=>window.open(`/api/v1/merchant/qr-codes/${qr.id}/svg?download=1`,"_blank")}>Download</button>
                {canWrite ? <button onClick={()=>void toggle(qr)}>{qr.isActive ? "Pause" : "Activate"}</button> : null}
              </div></td>
            </tr>)}
          </tbody></table>
        ) : <div className="merchantEmpty">No QR codes yet. Create your first measurable touchpoint above.</div>}
      </section>
    </>
  );
}
