"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { MerchantLocation, MerchantQrCode, MerchantRole } from "@/server/merchant/domain/merchant";

async function readError(response: Response, fallback: string) {
  try {
    const body = await response.json();
    return body.error?.message || fallback;
  } catch {
    return fallback;
  }
}

async function copyText(value: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Try the DOM fallback.
  }

  let area: HTMLTextAreaElement | null = null;
  try {
    area = document.createElement("textarea");
    area.value = value;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area?.remove();
  }
}

export default function QrManager({ qrCodes, locations, role }: { qrCodes: MerchantQrCode[]; locations: MerchantLocation[]; role: MerchantRole }) {
  const router = useRouter();
  const canWrite = role !== "viewer";
  const activeLocations = useMemo(() => locations.filter((item) => item.isActive), [locations]);
  const [locationId, setLocationId] = useState(activeLocations[0]?.id ?? "");
  const [name, setName] = useState("");
  const [sourceType, setSourceType] = useState("general");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (locationId && activeLocations.some((item) => item.id === locationId)) return;
    setLocationId(activeLocations[0]?.id ?? "");
  }, [activeLocations, locationId]);

  async function createQr(event: React.FormEvent) {
    event.preventDefault();
    if (loading || !locationId) return;

    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/v1/merchant/qr-codes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locationId, name, sourceType, reference: reference || undefined }),
      });
      if (!response.ok) throw new Error(await readError(response, "Could not create review touchpoint."));
      setName("");
      setSourceType("general");
      setReference("");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create review touchpoint.");
    } finally {
      setLoading(false);
    }
  }

  async function toggle(qr: MerchantQrCode) {
    if (updatingId) return;

    setUpdatingId(qr.id);
    setError("");
    try {
      const response = await fetch(`/api/v1/merchant/qr-codes/${qr.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isActive: !qr.isActive }),
      });
      if (!response.ok) throw new Error(await readError(response, "Could not update review touchpoint."));
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update review touchpoint.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function copyLink(qr: MerchantQrCode, channel: "nfc" | "qr") {
    setError("");
    const link = `${window.location.origin}/${channel === "nfc" ? "n" : "r"}/${encodeURIComponent(qr.publicToken)}`;
    if (!(await copyText(link))) {
      setError("The browser blocked automatic copying. Open the card link and copy its URL manually.");
      return;
    }

    const key = `${qr.id}-${channel}`;
    setCopied(key);
    window.setTimeout(() => setCopied((value) => value === key ? null : value), 1400);
  }

  return (
    <>
      {canWrite ? (
        <form className="merchantCard merchantFormCard" onSubmit={createQr}>
          <span className="merchantEyebrow">CREATE REVIEW TOUCHPOINT</span><h2>Create an NFC-ready review card</h2><p>Each card has its own secure public link for an NFC tag. Use a separate touchpoint for reception, checkout, room or counter so its review activity can be measured independently. A printable QR backup stays available.</p>
          <div className="merchantFormGrid">
            <div className="merchantField"><label>Location</label><select value={locationId} onChange={(e)=>setLocationId(e.target.value)} required><option value="">Select location</option>{activeLocations.map((location)=><option key={location.id} value={location.id}>{location.name}</option>)}</select></div>
            <div className="merchantField"><label>Card name</label><input value={name} onChange={(e)=>setName(e.target.value)} placeholder="e.g. Reception Desk / Table 12 / Room 204" required /></div>
            <div className="merchantField"><label>Touchpoint type</label><input value={sourceType} onChange={(e)=>setSourceType(e.target.value)} placeholder="e.g. reception, room, checkout, vehicle" required /></div>
            <div className="merchantField"><label>Reference (optional)</label><input value={reference} onChange={(e)=>setReference(e.target.value)} placeholder="e.g. branch-a-desk-01" /></div>
          </div>
          {!activeLocations.length ? <div className="merchantError">Activate or create a location before adding review cards.</div> : null}
          {error ? <div className="merchantError" role="alert">{error}</div> : null}
          <div className="merchantFormActions"><button className="merchantBtn" disabled={loading || Boolean(updatingId) || !locationId}>{loading ? "Creating…" : "Create card link"}</button></div>
        </form>
      ) : null}

      <section className="merchantCard merchantSectionCard nfcSetupInfo" aria-label="How to activate an NFC card">
        <div className="merchantSectionHead"><div><span className="merchantEyebrow">NFC CARD SETUP</span><h2>Tap to open your Google Review experience</h2><p>Cards do not need batteries or an NFC-enabled website. Write the HTTPS link to a compatible blank NFC tag once, then test the tap on a phone.</p></div></div>
        <div className="nfcSetupSteps">
          <div><span>01</span><strong>Create a card link</strong><p>Use one unique touchpoint per physical card, for example Reception Card 01.</p></div>
          <div><span>02</span><strong>Program the tag</strong><p>Tap “Copy NFC URL” below. In an NFC writing app, write it as a URL/URI NDEF record. Never store the Google review text on the card.</p></div>
          <div><span>03</span><strong>Test before printing</strong><p>Tap with an unlocked NFC-capable phone. Confirm the review page opens over HTTPS, and use the QR image as a fallback.</p></div>
        </div>
        <p>Tip: Write to an NTAG213/215/216 card, verify the saved URL, and only then lock the tag if needed. Pausing the link below disables the same review entry for that card and its QR backup.</p>
      </section>

      <section className="merchantCard merchantTableCard">
        <div className="merchantTableHead"><h2>NFC cards &amp; QR backups</h2><span className="merchantPill">{qrCodes.length} total</span></div>
        {qrCodes.length ? (
          <table className="merchantTable"><thead><tr><th>Card / touchpoint</th><th>Location</th><th>NFC destination</th><th>Status</th><th>Actions</th></tr></thead><tbody>
            {qrCodes.map((qr) => <tr key={qr.id}>
              <td><strong>{qr.name}</strong><small>{qr.sourceType}{qr.reference ? ` · ${qr.reference}` : ""}</small></td>
              <td><strong>{qr.locationName}</strong></td>
              <td><span className="merchantQrLink">/n/{qr.publicToken}</span><small>QR backup: /r/{qr.publicToken}</small></td>
              <td><span className={`merchantStatus ${qr.isActive ? "" : "off"}`}>{qr.isActive ? "Active" : "Paused"}</span></td>
              <td><div className="merchantActions">
                <button type="button" onClick={()=>void copyLink(qr, "nfc")}>{copied === `${qr.id}-nfc` ? "Copied!" : "Copy NFC URL"}</button>
                <button type="button" onClick={()=>window.open(`/n/${encodeURIComponent(qr.publicToken)}`, "_blank", "noopener,noreferrer")}>Test link</button>
                <button type="button" onClick={()=>void copyLink(qr, "qr")}>{copied === `${qr.id}-qr` ? "Copied!" : "Copy QR URL"}</button>
                <button type="button" onClick={()=>window.open(`/api/v1/merchant/qr-codes/${qr.id}/svg`,"_blank","noopener,noreferrer")}>View QR</button>
                <button type="button" onClick={()=>window.open(`/api/v1/merchant/qr-codes/${qr.id}/svg?download=1`,"_blank","noopener,noreferrer")}>Download</button>
                {canWrite ? <button type="button" disabled={Boolean(updatingId)} onClick={()=>void toggle(qr)}>{updatingId === qr.id ? "Updating…" : qr.isActive ? "Pause" : "Activate"}</button> : null}
              </div></td>
            </tr>)}
          </tbody></table>
        ) : <div className="merchantEmpty">No review links yet. Create your first NFC-ready card above.</div>}
      </section>
    </>
  );
}
