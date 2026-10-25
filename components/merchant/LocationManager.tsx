"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import GooglePlacePicker from "@/components/merchant/GooglePlacePicker";
import StandeePreviewModal from "@/components/merchant/StandeePreviewModal";
import type { MerchantLocation, MerchantQrCode, MerchantRole, StandeeItem } from "@/server/merchant/domain/merchant";
import styles from "./LocationManager.module.css";

function merchantInitials(name: string): string {
  if (!name) return "QR";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fallback */
  }

  let area: HTMLTextAreaElement | null = null;
  try {
    area = document.createElement("textarea");
    area.value = text;
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

export default function LocationManager({
  locations,
  qrCodes = [],
  standees = [],
  role,
  placesSearchEnabled,
}: {
  locations: MerchantLocation[];
  qrCodes?: MerchantQrCode[];
  standees?: StandeeItem[];
  role: MerchantRole;
  placesSearchEnabled: boolean;
}) {
  const router = useRouter();
  const canWrite = role !== "viewer";

  // Modal open states
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [activeModalLocation, setActiveModalLocation] = useState<{
    location: MerchantLocation;
    qr?: MerchantQrCode;
  } | null>(null);

  // Form input states
  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [keywords, setKeywords] = useState("");
  const [googlePlaceId, setGooglePlaceId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Search filter for registered merchants table
  const [filterQuery, setFilterQuery] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Close modals on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsRegisterModalOpen(false);
        setActiveModalLocation(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Standee stock and mapping
  const unassignedStandees = useMemo(() => {
    return standees.filter((s) => s.status === "unassigned");
  }, [standees]);

  const [useStandee, setUseStandee] = useState(true);
  const [selectedStandeeId, setSelectedStandeeId] = useState("");

  useEffect(() => {
    if (unassignedStandees.length > 0 && !selectedStandeeId) {
      setSelectedStandeeId(unassignedStandees[0].id);
    }
  }, [unassignedStandees, selectedStandeeId]);

  const standeeByLocationId = useMemo(() => {
    const map = new Map<string, StandeeItem>();
    for (const s of standees) {
      if (s.locationId) {
        map.set(s.locationId, s);
      }
    }
    return map;
  }, [standees]);

  // Map each location to its primary QR code
  const qrByLocationId = useMemo(() => {
    const map = new Map<string, MerchantQrCode>();
    for (const qr of qrCodes) {
      if (!map.has(qr.locationId)) {
        map.set(qr.locationId, qr);
      }
    }
    return map;
  }, [qrCodes]);

  const activeCount = useMemo(() => locations.filter((l) => l.isActive).length, [locations]);
  const connectedCount = useMemo(() => locations.filter((l) => Boolean(l.googlePlaceId)).length, [locations]);

  const filteredLocations = useMemo(() => {
    if (!filterQuery.trim()) return locations;
    const q = filterQuery.toLowerCase();
    return locations.filter(
      (loc) =>
        loc.name.toLowerCase().includes(q) ||
        loc.subtitle.toLowerCase().includes(q) ||
        loc.publicId.toLowerCase().includes(q),
    );
  }, [locations, filterQuery]);

  async function handleCopy(key: string, url: string) {
    const success = await copyToClipboard(url);
    if (success) {
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((curr) => (curr === key ? null : curr)), 1800);
    }
  }

  async function createLocation(event: React.FormEvent) {
    event.preventDefault();
    if (loading || !googlePlaceId.trim()) return;

    setLoading(true);
    setError("");
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        subtitle: subtitle.trim() || undefined,
        keywords: keywords.trim() || undefined,
        googlePlaceId,
      };
      if (useStandee && selectedStandeeId) {
        payload.standeeId = selectedStandeeId;
      }

      const response = await fetch("/api/v1/merchant/locations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        throw new Error(data?.error?.message || "Could not register client merchant.");
      }

      setName("");
      setSubtitle("");
      setKeywords("");
      setGooglePlaceId("");
      setIsRegisterModalOpen(false);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not register client merchant.");
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
      if (!response.ok) throw new Error("Could not update merchant status.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update merchant status.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className={styles.pageContainer}>
      {/* ------------------------------------------------------------------
          TOP KPI METRIC STRIP
          ------------------------------------------------------------------ */}
      <section className={styles.kpiStrip} aria-label="Merchants overview">
        <div className={styles.kpiCard}>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>Total Merchants</span>
            <span className={styles.kpiValue}>{locations.length}</span>
            <span className={styles.kpiSub}>Registered client businesses</span>
          </div>
          <div className={styles.kpiIconWrap} aria-hidden="true">🏢</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>Active QR Review Links</span>
            <span className={styles.kpiValue} style={{ color: "#059669" }}>{activeCount}</span>
            <span className={styles.kpiSub}>Currently collecting reviews</span>
          </div>
          <div className={styles.kpiIconWrap} aria-hidden="true">⚡</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>Google Review Mappings</span>
            <span className={styles.kpiValue} style={{ color: "#2563eb" }}>{connectedCount}</span>
            <span className={styles.kpiSub}>Verified Google Places</span>
          </div>
          <div className={styles.kpiIconWrap} style={{ background: "#eff6ff", borderColor: "#bfdbfe", color: "#2563eb" }} aria-hidden="true">
            🎯
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>Ready Standees in Stock</span>
            <span className={styles.kpiValue} style={{ color: "#d97706" }}>{unassignedStandees.length}</span>
            <span className={styles.kpiSub}>Available in bag to deploy</span>
          </div>
          <div className={styles.kpiIconWrap} style={{ background: "#fffbeb", borderColor: "#fde68a", color: "#d97706" }} aria-hidden="true">
            ⭐
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------
          REGISTERED MERCHANTS TABLE WITH TOP REGISTER BUTTON
          ------------------------------------------------------------------ */}
      <section className={`${styles.card} ${styles.tableCard}`}>
        <div className={styles.tableToolbar}>
          <div className={styles.tableTitleArea}>
            <h2>Registered Client Merchants</h2>
            <span className={styles.countBadge}>
              {activeCount} Active · {locations.length} Total
            </span>
          </div>

          <div className={styles.toolbarActions}>
            <div className={styles.searchBox}>
              <svg
                className={styles.searchIcon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search merchants by name or city…"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
              />
            </div>

            {canWrite ? (
              <button
                type="button"
                className={styles.openRegisterBtn}
                onClick={() => {
                  setError("");
                  setIsRegisterModalOpen(true);
                }}
              >
                <span className={styles.btnPlusCircle}>+</span>
                <span>Register New Client Merchant</span>
              </button>
            ) : null}
          </div>
        </div>

        {filteredLocations.length ? (
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Merchant &amp; Details</th>
                  <th>Google Destination</th>
                  <th>Customer Live Link</th>
                  <th>Printable QR Standee</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredLocations.map((location) => {
                  const primaryQr = qrByLocationId.get(location.id);
                  const assignedStandee = standeeByLocationId.get(location.id);
                  const customerPath = primaryQr ? `/r/${primaryQr.publicToken}` : `/r/${location.publicId}`;
                  const fullCustomerUrl = typeof window !== "undefined"
                    ? `${window.location.origin}${customerPath}`
                    : customerPath;
                  const isCopied = copiedKey === location.id;

                  return (
                    <tr key={location.id}>
                      {/* 1. Merchant Avatar & Name */}
                      <td>
                        <div className={styles.merchantCell}>
                          <div className={styles.merchantAvatar} aria-hidden="true">
                            {merchantInitials(location.name)}
                          </div>
                          <div className={styles.merchantTextGroup}>
                            <span className={styles.merchantName}>{location.name}</span>
                            <span className={styles.merchantSubtitle}>
                              {location.subtitle || "No branch specified"}
                            </span>
                            <span className={styles.merchantSlug}>/{location.publicId}</span>
                            {location.keywords ? (
                              <span
                                style={{
                                  fontSize: "0.6875rem",
                                  color: "#059669",
                                  background: "#ecfdf5",
                                  border: "1px solid #a7f3d0",
                                  borderRadius: "4px",
                                  padding: "2px 6px",
                                  display: "inline-block",
                                  marginTop: "3px",
                                  maxWidth: "240px",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  fontWeight: 500,
                                }}
                                title={`SEO Keywords: ${location.keywords}`}
                              >
                                🎯 SEO: {location.keywords}
                              </span>
                            ) : null}
                            {assignedStandee ? (
                              <span
                                className={styles.standeePillBadge}
                                title={`Physical Standee Code: ${assignedStandee.standeeCode}`}
                              >
                                ⭐ Standee: <strong>{assignedStandee.standeeCode}</strong>
                              </span>
                            ) : (
                              <span className={styles.digitalQrPillBadge}>Digital QR</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 2. Google Destination */}
                      <td>
                        <div className={styles.googleStatusGroup}>
                          <span className={styles.googleConnectedBadge}>
                            ✓ Google Verified
                          </span>
                          <a
                            href={location.googleReviewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.googleLink}
                            title={location.googleReviewUrl}
                          >
                            Open Review Form ↗
                          </a>
                        </div>
                      </td>

                      {/* 3. Customer Live Link */}
                      <td>
                        <div className={styles.reviewLinkRow}>
                          <span className={styles.reviewLinkCode} title={customerPath}>
                            {customerPath}
                          </span>
                          <button
                            type="button"
                            className={`${styles.copyBtn} ${isCopied ? styles.copied : ""}`}
                            onClick={() => void handleCopy(location.id, fullCustomerUrl)}
                            title="Copy customer review link"
                          >
                            <span className={styles.actionIcon}>{isCopied ? "✓" : "📋"}</span>
                            <span>{isCopied ? "Copied" : "Copy"}</span>
                          </button>
                          <a
                            href={customerPath}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.testLink}
                            title="Test live review experience"
                          >
                            <span className={styles.actionIcon}>🔗</span>
                            <span>Test ↗</span>
                          </a>
                        </div>
                      </td>

                      {/* 4. QR Standee Action */}
                      <td>
                        {primaryQr ? (
                          <div className={styles.qrActionsGroup}>
                            <button
                              type="button"
                              className={styles.viewQrBtn}
                              onClick={() => setActiveModalLocation({ location, qr: primaryQr })}
                              title="Preview printable table standee"
                            >
                              👁 View Standee
                            </button>
                            <a
                              href={`/api/v1/merchant/qr-codes/${primaryQr.id}/svg?download=1`}
                              className={styles.downloadQrBtn}
                              download
                              title="Download print-ready SVG standee"
                            >
                              ⬇ SVG
                            </a>
                          </div>
                        ) : (
                          <small style={{ color: "#94a3b8" }}>Generating…</small>
                        )}
                      </td>

                      {/* 5. Status Badge */}
                      <td>
                        <span
                          className={`${styles.statusBadge} ${
                            location.isActive ? styles.statusActive : styles.statusPaused
                          }`}
                        >
                          {location.isActive ? "● Active" : "○ Paused"}
                        </span>
                      </td>

                      {/* 6. Pause / Activate Action */}
                      <td>
                        {canWrite ? (
                          <button
                            type="button"
                            className={location.isActive ? styles.pauseActionBtn : styles.activateActionBtn}
                            disabled={Boolean(updatingId)}
                            onClick={() => void toggle(location)}
                            title={location.isActive ? "Pause customer reviews for this merchant" : "Activate customer reviews"}
                          >
                            <span className={styles.actionIcon}>{location.isActive ? "⏸" : "▶"}</span>
                            <span>
                              {updatingId === location.id
                                ? "Updating…"
                                : location.isActive
                                ? "Pause"
                                : "Activate"}
                            </span>
                          </button>
                        ) : (
                          <small style={{ color: "#94a3b8" }}>View only</small>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.emptyState}>
            {filterQuery.trim()
              ? `No merchants found matching "${filterQuery}".`
              : "No client merchants registered yet. Click \"+ Register New Client Merchant\" above to add your first client."}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------
          POPUP MODAL: REGISTER NEW CLIENT MERCHANT
          ------------------------------------------------------------------ */}
      {isRegisterModalOpen && canWrite ? (
        <div
          className={styles.modalOverlay}
          onClick={() => setIsRegisterModalOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className={styles.registerModalCard}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div className={styles.modalHeaderTitle}>
                <span className={styles.modalEyebrow}>SUPER ADMIN ONBOARDING</span>
                <h3>Register New Client Merchant</h3>
                <p>
                  Connect the client’s Google Maps listing. A live customer review link and printable QR standee will be generated immediately.
                </p>
              </div>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setIsRegisterModalOpen(false)}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <form onSubmit={createLocation}>
              <div className={styles.modalFormBody}>
                {/* STEP 1: GOOGLE MAPS CONNECTION */}
                <div className={styles.stepBox}>
                  <div className={styles.stepHeader}>
                    <span className={styles.stepNumber}>1</span>
                    <span>Find &amp; Connect Google Maps Business</span>
                  </div>
                  <GooglePlacePicker
                    enabled={placesSearchEnabled}
                    value={googlePlaceId}
                    onChange={setGooglePlaceId}
                    onSelectDetails={(details) => {
                      if (!name.trim()) setName(details.mainText);
                      if (!subtitle.trim()) setSubtitle(details.secondaryText);
                    }}
                    disabled={loading || Boolean(updatingId)}
                  />
                </div>

                {/* STEP 2: MERCHANT BRANDING & DETAILS */}
                <div className={styles.stepBox}>
                  <div className={styles.stepHeader}>
                    <span className={styles.stepNumber} style={{ background: "#059669" }}>2</span>
                    <span>Merchant Display Details</span>
                  </div>
                  <div className={styles.formGrid}>
                    <div className={styles.field}>
                      <label htmlFor="merchant-name">Merchant / Business Name</label>
                      <input
                        id="merchant-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Ashish Law Book House / Royal Cafe"
                        required
                      />
                    </div>
                    <div className={styles.field}>
                      <label htmlFor="merchant-subtitle">Branch / City Tagline (optional)</label>
                      <input
                        id="merchant-subtitle"
                        value={subtitle}
                        onChange={(e) => setSubtitle(e.target.value)}
                        placeholder="e.g. Indore Main Market / Connaught Place"
                      />
                    </div>
                    <div className={styles.field} style={{ gridColumn: "1 / -1" }}>
                      <label htmlFor="merchant-keywords">
                        Product &amp; Service Keywords <span style={{ fontSize: "0.75rem", color: "#059669", fontWeight: "normal" }}>— (Google Maps SEO Ranking)</span>
                      </label>
                      <input
                        id="merchant-keywords"
                        value={keywords}
                        onChange={(e) => setKeywords(e.target.value)}
                        placeholder="e.g. Keratin Treatment, Hydra Facial, Haircut, Bridal Makeup (comma-separated)"
                      />
                      <small style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "4px", display: "block" }}>
                        AI naturally mentions these services in customer reviews so this business ranks #1 on Google Maps.
                      </small>
                    </div>
                  </div>

                  {name.trim() ? (
                    <div className={styles.slugPreview}>
                      <span>Customer Review Link:</span>
                      <code>/r/{name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "..."}</code>
                    </div>
                  ) : null}
                </div>

                {/* STEP 3: PHYSICAL COUNTER STANDEE INVENTORY */}
                <div className={styles.stepBox}>
                  <div className={styles.stepHeader}>
                    <span className={styles.stepNumber} style={{ background: "#d97706" }}>3</span>
                    <span>Physical Acrylic Standee (Inventory)</span>
                  </div>

                  <div style={{ display: "flex", gap: "1.25rem", margin: "0.5rem 0 0.85rem" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.45rem", cursor: "pointer", fontSize: "0.875rem", fontWeight: 600 }}>
                      <input
                        type="radio"
                        name="standee-mode"
                        checked={useStandee}
                        onChange={() => setUseStandee(true)}
                      />
                      <span>⚡ Bind Pre-Printed Standee (Counter Deployment)</span>
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.45rem", cursor: "pointer", fontSize: "0.875rem", fontWeight: 600 }}>
                      <input
                        type="radio"
                        name="standee-mode"
                        checked={!useStandee}
                        onChange={() => setUseStandee(false)}
                      />
                      <span>Digital QR Link Only</span>
                    </label>
                  </div>

                  {useStandee ? (
                    unassignedStandees.length > 0 ? (
                      <div className={styles.field}>
                        <label htmlFor="standee-select">Choose Available Standee Code from Bag / Stock</label>
                        <select
                          id="standee-select"
                          value={selectedStandeeId}
                          onChange={(e) => setSelectedStandeeId(e.target.value)}
                          className={styles.modalSelect}
                        >
                          {unassignedStandees.map((st) => (
                            <option key={st.id} value={st.id}>
                              {st.standeeCode} — {st.batchName} (Ready to Deploy 🟢)
                            </option>
                          ))}
                        </select>
                        <small style={{ color: "#059669", marginTop: "0.35rem", display: "block", fontWeight: 600 }}>
                          ✓ Standee {unassignedStandees.find((s) => s.id === selectedStandeeId)?.standeeCode} will instantly route to this merchant&apos;s Google Review destination!
                        </small>
                      </div>
                    ) : (
                      <div style={{ background: "#fffbeb", border: "1px solid #fef3c7", padding: "0.75rem", borderRadius: "0.5rem", fontSize: "0.8125rem", color: "#92400e" }}>
                        No unassigned standees in stock. Go to <strong>Standees &amp; QR Codes</strong> to generate a batch of 20 or 50 standees for printing. A digital QR code will be generated for now.
                      </div>
                    )
                  ) : (
                    <small style={{ color: "#64748b", display: "block" }}>
                      A dynamic digital QR code touchpoint will be generated for online / WhatsApp sharing.
                    </small>
                  )}
                </div>

                {error ? <div className={styles.errorMessage} role="alert">{error}</div> : null}
              </div>

              <div className={styles.modalFooter}>
                <div className={styles.submitHint}>
                  {!googlePlaceId.trim() ? (
                    <span>⚠️ Select a Google Maps listing in Step 1 to enable.</span>
                  ) : (
                    <span style={{ color: "#15803d", fontWeight: 700 }}>
                      ✓ Google verified. Ready to generate QR standee!
                    </span>
                  )}
                </div>

                <div className={styles.modalFooterActions}>
                  <button
                    type="button"
                    className={styles.cancelBtn}
                    onClick={() => setIsRegisterModalOpen(false)}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={styles.submitBtn}
                    disabled={loading || Boolean(updatingId) || !googlePlaceId.trim()}
                  >
                    {loading ? "Registering…" : "+ Register & Generate QR Standee"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* ------------------------------------------------------------------
          POPUP MODAL: ACRYLIC STANDEE PREVIEW
          ------------------------------------------------------------------ */}
      {activeModalLocation && activeModalLocation.qr ? (
        <StandeePreviewModal
          standeeCode={
            standeeByLocationId.get(activeModalLocation.location.id)?.standeeCode ||
            `QR-${activeModalLocation.location.publicId.slice(0, 6).toUpperCase()}`
          }
          publicToken={activeModalLocation.qr.publicToken}
          standeeId={standeeByLocationId.get(activeModalLocation.location.id)?.id}
          locationName={activeModalLocation.location.name}
          isAssigned={true}
          locations={locations}
          onClose={() => setActiveModalLocation(null)}
        />
      ) : null}
    </div>
  );
}
