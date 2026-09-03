"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import GooglePlacePicker from "@/components/merchant/GooglePlacePicker";
import type { MerchantLocation, MerchantRole } from "@/server/merchant/domain/merchant";

async function readError(response: Response, fallback: string) {
  try {
    const body = await response.json();
    return body.error?.message || fallback;
  } catch {
    return fallback;
  }
}

export default function LocationManager({
  locations,
  role,
  placesSearchEnabled,
}: {
  locations: MerchantLocation[];
  role: MerchantRole;
  placesSearchEnabled: boolean;
}) {
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
    if (loading || !googlePlaceId.trim()) return;

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
          <span className="merchantEyebrow">ADD LOCATION</span><h2>Connect a Google Business location</h2><p>Search for the exact Google Maps listing instead of finding a technical Place ID manually. QR Review stores only the selected Place ID for direct Google review handoff.</p>
          <div className="merchantFormGrid">
            <div className="merchantField"><label>Location label</label><input value={name} onChange={(e)=>setName(e.target.value)} placeholder="e.g. Main Branch / Downtown Location" required /></div>
            <div className="merchantField"><label>Customer subtitle (optional)</label><input value={subtitle} onChange={(e)=>setSubtitle(e.target.value)} placeholder="e.g. Share your experience in under a minute." /></div>
          </div>
          <GooglePlacePicker enabled={placesSearchEnabled} value={googlePlaceId} onChange={setGooglePlaceId} disabled={loading || Boolean(updatingId)} />
          {error ? <div className="merchantError" role="alert">{error}</div> : null}
          <div className="merchantFormActions"><button className="merchantBtn" disabled={loading || Boolean(updatingId) || !googlePlaceId.trim()}>{loading ? "Creating…" : "Add location"}</button></div>
        </form>
      ) : null}

      <section className="merchantCard merchantTableCard">
        <div className="merchantTableHead"><h2>Locations</h2><span className="merchantPill">{locations.length} total</span></div>
        {locations.length ? (
          <table className="merchantTable"><thead><tr><th>Location</th><th>Google connection</th><th>Public ID</th><th>Status</th><th>Action</th></tr></thead><tbody>
            {locations.map((location) => <tr key={location.id}>
              <td><strong>{location.name}</strong><small>{location.subtitle || "—"}</small></td>
              <td><span className="merchantStatus">Connected</span><small>Google Maps review destination</small></td>
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
