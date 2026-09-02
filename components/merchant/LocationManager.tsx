"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { MerchantLocation, MerchantRole } from "@/server/merchant/domain/merchant";

async function readError(response: Response, fallback: string) {
  try {
    const body = await response.json();
    return body.error?.message || fallback;
  } catch {
    return fallback;
  }
}

export default function LocationManager({ locations, role }: { locations: MerchantLocation[]; role: MerchantRole }) {
  const router = useRouter();
  const canWrite = role !== "viewer";
  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [googlePlaceId, setGooglePlaceId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function createLocation(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/v1/merchant/locations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, subtitle: subtitle || undefined, googlePlaceId }),
      });
      if (!response.ok) throw new Error(await readError(response, "Could not create location."));

      setName("");
      setSubtitle("");
      setGooglePlaceId("");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create location.");
    } finally {
      setLoading(false);
    }
  }

  async function toggle(location: MerchantLocation) {
    if (updatingId) return;

    setUpdatingId(location.id);
    setError("");
    try {
      const response = await fetch(`/api/v1/merchant/locations/${location.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isActive: !location.isActive }),
      });
      if (!response.ok) throw new Error(await readError(response, "Could not update location."));
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update location.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <>
      {canWrite ? (
        <form className="merchantCard merchantFormCard" onSubmit={createLocation}>
          <span className="merchantEyebrow">ADD LOCATION</span><h2>Connect a Google Business location</h2><p>Store the Google Place ID once; customer scans will use the direct review composer without a live Places lookup.</p>
          <div className="merchantFormGrid">
            <div className="merchantField"><label>Location name</label><input value={name} onChange={(e)=>setName(e.target.value)} placeholder="e.g. Mangal Traders - Main Store" required /></div>
            <div className="merchantField"><label>Google Place ID</label><input value={googlePlaceId} onChange={(e)=>setGooglePlaceId(e.target.value)} placeholder="ChIJ…" required /></div>
            <div className="merchantField" style={{gridColumn:"1 / -1"}}><label>Customer subtitle (optional)</label><input value={subtitle} onChange={(e)=>setSubtitle(e.target.value)} placeholder="Fast feedback. No login required." /></div>
          </div>
          {error ? <div className="merchantError" role="alert">{error}</div> : null}
          <div className="merchantFormActions"><button className="merchantBtn" disabled={loading || Boolean(updatingId)}>{loading ? "Creating…" : "Add location"}</button></div>
        </form>
      ) : null}

      <section className="merchantCard merchantTableCard">
        <div className="merchantTableHead"><h2>Locations</h2><span className="merchantPill">{locations.length} total</span></div>
        {locations.length ? (
          <table className="merchantTable"><thead><tr><th>Location</th><th>Google Place</th><th>Public ID</th><th>Status</th><th>Action</th></tr></thead><tbody>
            {locations.map((location) => <tr key={location.id}>
              <td><strong>{location.name}</strong><small>{location.subtitle || "—"}</small></td>
              <td><span className="merchantQrLink">{location.googlePlaceId}</span></td>
              <td><span className="merchantQrLink">{location.publicId}</span></td>
              <td><span className={`merchantStatus ${location.isActive ? "" : "off"}`}>{location.isActive ? "Active" : "Paused"}</span></td>
              <td>{canWrite ? <div className="merchantActions"><button type="button" disabled={Boolean(updatingId)} onClick={()=>void toggle(location)}>{updatingId === location.id ? "Updating…" : location.isActive ? "Pause" : "Activate"}</button></div> : <small>Read only</small>}</td>
            </tr>)}
          </tbody></table>
        ) : <div className="merchantEmpty">No locations yet.</div>}
      </section>
    </>
  );
}
