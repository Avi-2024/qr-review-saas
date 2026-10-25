"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import StandeePreviewModal from "@/components/merchant/StandeePreviewModal";
import type { MerchantLocation, MerchantQrCode, MerchantRole, StandeeItem } from "@/server/merchant/domain/merchant";
import styles from "./QrManager.module.css";

async function copyText(value: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // DOM fallback
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

export default function QrManager({
  qrCodes,
  locations,
  standees = [],
  role,
}: {
  qrCodes: MerchantQrCode[];
  locations: MerchantLocation[];
  standees?: StandeeItem[];
  role: MerchantRole;
}) {
  const router = useRouter();
  const canWrite = role !== "viewer";

  // Active Tab: 'standees' (default) vs 'digital'
  const [activeTab, setActiveTab] = useState<"standees" | "digital">("standees");

  // Batch Generation Modal State
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchCount, setBatchCount] = useState(20);
  const [batchPrefix, setBatchPrefix] = useState("ST-");
  const [batchName, setBatchName] = useState("Market Visit Batch");
  const [batchLoading, setBatchLoading] = useState(false);

  // Quick Assign Modal State
  const [assigningStandee, setAssigningStandee] = useState<StandeeItem | null>(null);
  const [targetLocationId, setTargetLocationId] = useState(locations[0]?.id || "");
  const [assignLoading, setAssignLoading] = useState(false);

  // Standee Acrylic Preview Modal
  const [previewStandee, setPreviewStandee] = useState<StandeeItem | null>(null);

  // Digital QR Form States
  const activeLocations = useMemo(() => locations.filter((item) => item.isActive), [locations]);
  const [locationId, setLocationId] = useState(activeLocations[0]?.id ?? "");
  const [name, setName] = useState("");
  const [sourceType, setSourceType] = useState("general");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  // Stock stats
  const inStockCount = useMemo(() => standees.filter((s) => s.status === "unassigned").length, [standees]);
  const deployedCount = useMemo(() => standees.filter((s) => s.status === "assigned").length, [standees]);

  useEffect(() => {
    if (locationId && activeLocations.some((item) => item.id === locationId)) return;
    setLocationId(activeLocations[0]?.id ?? "");
  }, [activeLocations, locationId]);

  // Handle Batch Generation
  async function handleCreateBatch(e: React.FormEvent) {
    e.preventDefault();
    if (batchLoading) return;

    setBatchLoading(true);
    setError("");
    try {
      const res = await fetch("/api/v1/merchant/standees/batch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ count: batchCount, prefix: batchPrefix, batchName }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error?.message || "Could not generate standees batch.");
      }

      setIsBatchModalOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Batch creation failed.");
    } finally {
      setBatchLoading(false);
    }
  }

  // Handle Quick Assigning Standee to Merchant
  async function handleAssignStandee(e: React.FormEvent) {
    e.preventDefault();
    if (!assigningStandee || !targetLocationId || assignLoading) return;

    setAssignLoading(true);
    setError("");
    try {
      const res = await fetch("/api/v1/merchant/standees/assign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          standeeId: assigningStandee.id,
          locationId: targetLocationId,
          notes: "Assigned via Standee Inventory manager",
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error?.message || "Could not assign standee.");
      }

      setAssigningStandee(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assignment failed.");
    } finally {
      setAssignLoading(false);
    }
  }

  // Handle Unbinding Standee back to Stock
  async function handleUnbindStandee(standeeId: string) {
    if (!confirm("Are you sure you want to return this standee to available inventory? It will disconnect from the current merchant.")) {
      return;
    }

    try {
      const res = await fetch("/api/v1/merchant/standees/unbind", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ standeeId }),
      });
      if (!res.ok) throw new Error("Could not unbind standee.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbinding failed.");
    }
  }

  // Digital QR create
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
      if (!response.ok) throw new Error("Could not create review touchpoint.");
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
      if (!response.ok) throw new Error("Could not update review touchpoint.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update review touchpoint.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleCopy(url: string, key: string) {
    if (await copyText(url)) {
      setCopied(key);
      window.setTimeout(() => setCopied((val) => (val === key ? null : val)), 1500);
    }
  }

  return (
    <div className={styles.pageContainer}>
      {/* ------------------------------------------------------------------
          TOP KPI METRIC STRIP
          ------------------------------------------------------------------ */}
      <section className={styles.kpiStrip} aria-label="Standee Inventory Stats">
        <div className={styles.kpiCard}>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>Standees In Stock</span>
            <span className={styles.kpiValue} style={{ color: "#059669" }}>
              {inStockCount}
            </span>
            <span className={styles.kpiSub}>Ready in bag to deploy</span>
          </div>
          <div
            className={styles.kpiIconWrap}
            style={{ background: "#ecfdf5", borderColor: "#a7f3d0", color: "#059669" }}
            aria-hidden="true"
          >
            📦
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>Deployed on Counters</span>
            <span className={styles.kpiValue} style={{ color: "#2563eb" }}>
              {deployedCount}
            </span>
            <span className={styles.kpiSub}>Active in client shops</span>
          </div>
          <div
            className={styles.kpiIconWrap}
            style={{ background: "#eff6ff", borderColor: "#bfdbfe", color: "#2563eb" }}
            aria-hidden="true"
          >
            🏪
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>Total Standees Minted</span>
            <span className={styles.kpiValue}>{standees.length}</span>
            <span className={styles.kpiSub}>Pre-printed inventory batch</span>
          </div>
          <div className={styles.kpiIconWrap} aria-hidden="true">
            ⭐
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------
          CONTROLS HEADER: TABS & ACTION BUTTONS
          ------------------------------------------------------------------ */}
      <div className={styles.controlHeader}>
        <div className={styles.tabGroup}>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === "standees" ? styles.tabBtnActive : ""}`}
            onClick={() => setActiveTab("standees")}
          >
            <span>⚡ Pre-Printed Standees</span>
            <span className={styles.tabBadge}>{standees.length}</span>
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === "digital" ? styles.tabBtnActive : ""}`}
            onClick={() => setActiveTab("digital")}
          >
            <span>📱 Digital &amp; NFC Links</span>
            <span className={styles.tabBadge}>{qrCodes.length}</span>
          </button>
        </div>

        {canWrite && activeTab === "standees" ? (
          <div className={styles.actionBtnGroup}>
            <Link
              href="/dashboard/qr-codes/print"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.bulkPrintBtn}
              title="Open Bulk Print & Export PDF Studio in new tab"
            >
              <span>🖨️ Bulk Print / PDF Sheet</span>
            </Link>
            <button
              type="button"
              className={styles.batchGenerateBtn}
              onClick={() => setIsBatchModalOpen(true)}
            >
              <span>+ Generate Standees Batch</span>
            </button>
          </div>
        ) : null}
      </div>

      {error ? (
        <div style={{ background: "#fef2f2", color: "#b91c1c", padding: "0.75rem 1rem", borderRadius: "0.5rem", border: "1px solid #fecaca" }}>
          {error}
        </div>
      ) : null}

      {/* ------------------------------------------------------------------
          TAB 1: PRE-PRINTED STANDEES INVENTORY
          ------------------------------------------------------------------ */}
      {activeTab === "standees" ? (
        <section className={styles.inventoryCard}>
          <div className={styles.inventoryCardHeader}>
            <div>
              <h2 className={styles.inventoryTitle}>Pre-Printed Standees Stock</h2>
              <p className={styles.inventorySubtitle}>
                Bulk print acrylic standees with these codes in advance. When pitching a shopkeeper, place the standee
                on counter and bind it in 5 seconds!
              </p>
            </div>
            {standees.length ? (
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <Link
                  href="/dashboard/qr-codes/print?filter=unassigned"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.quickPrintStockBtn}
                >
                  📄 Print In-Stock ({inStockCount})
                </Link>
              </div>
            ) : null}
          </div>

          {standees.length ? (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Standee Code</th>
                    <th>Status</th>
                    <th>Assigned Merchant</th>
                    <th>Batch</th>
                    <th>Public QR Destination</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {standees.map((st) => {
                    const isAssigned = st.status === "assigned";
                    const routeUrl = typeof window !== "undefined"
                      ? `${window.location.origin}/r/${st.publicToken}`
                      : `/r/${st.publicToken}`;
                    const isCopied = copied === st.id;

                    return (
                      <tr key={st.id}>
                        {/* Standee Code */}
                        <td>
                          <span className={styles.standeeCodeBadge}>{st.standeeCode}</span>
                        </td>

                        {/* Status */}
                        <td>
                          {isAssigned ? (
                            <span className={styles.statusPillDeployed}>
                              <span className={styles.statusDotBlue} />
                              Deployed on Counter
                            </span>
                          ) : (
                            <span className={styles.statusPillAvailable}>
                              <span className={styles.statusDotGreen} />
                              In Stock (Ready)
                            </span>
                          )}
                        </td>

                        {/* Assigned Merchant */}
                        <td>
                          {isAssigned ? (
                            <strong style={{ color: "#0f172a" }}>{st.locationName || "Client Merchant"}</strong>
                          ) : (
                            <span style={{ color: "#94a3b8", fontStyle: "italic" }}>Unassigned (Available in Bag)</span>
                          )}
                        </td>

                        {/* Batch */}
                        <td>
                          <small style={{ color: "#64748b" }}>{st.batchName}</small>
                        </td>

                        {/* Destination Link */}
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            <code style={{ fontSize: "0.8125rem", color: "#475569" }}>/r/{st.publicToken}</code>
                            <button
                              type="button"
                              className={styles.actionPillBtn}
                              style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
                              onClick={() => void handleCopy(routeUrl, st.id)}
                            >
                              {isCopied ? "Copied ✓" : "Copy"}
                            </button>
                            <button
                              type="button"
                              className={styles.actionPillBtn}
                              style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
                              onClick={() => window.open(`/r/${st.publicToken}`, "_blank", "noopener,noreferrer")}
                            >
                              Test ↗
                            </button>
                          </div>
                        </td>

                        {/* Actions */}
                        <td>
                          <div className={styles.actionRow}>
                            <button
                              type="button"
                              className={styles.actionPillBtn}
                              onClick={() => setPreviewStandee(st)}
                            >
                              👁 View Standee
                            </button>

                            {canWrite && !isAssigned ? (
                              <button
                                type="button"
                                className={styles.actionAssignBtn}
                                onClick={() => {
                                  setAssigningStandee(st);
                                  setTargetLocationId(locations[0]?.id || "");
                                }}
                              >
                                ⚡ Assign to Merchant
                              </button>
                            ) : null}

                            {canWrite && isAssigned ? (
                              <button
                                type="button"
                                className={styles.actionUnbindBtn}
                                onClick={() => void handleUnbindStandee(st.id)}
                              >
                                Unbind
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.emptyState}>
              No standees generated yet. Click &quot;+ Generate Standees Batch&quot; above to create your first bulk printing stock.
            </div>
          )}
        </section>
      ) : (
        /* ------------------------------------------------------------------
           TAB 2: DIGITAL QR CODES & NFC SETUP
           ------------------------------------------------------------------ */
        <>
          {canWrite ? (
            <form className="merchantCard merchantFormCard" onSubmit={createQr}>
              <span className="merchantEyebrow">CREATE REVIEW TOUCHPOINT</span>
              <h2>Create an NFC-ready review card</h2>
              <p>
                Each card has its own secure public link for an NFC tag. Use a separate touchpoint for reception, checkout,
                room or counter so its review activity can be measured independently. A printable QR backup stays available.
              </p>
              <div className="merchantFormGrid">
                <div className="merchantField">
                  <label>Location</label>
                  <select value={locationId} onChange={(e) => setLocationId(e.target.value)} required>
                    <option value="">Select location</option>
                    {activeLocations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="merchantField">
                  <label>Card name</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Reception Desk / Table 12 / Room 204"
                    required
                  />
                </div>
                <div className="merchantField">
                  <label>Touchpoint type</label>
                  <input
                    value={sourceType}
                    onChange={(e) => setSourceType(e.target.value)}
                    placeholder="e.g. reception, room, checkout, vehicle"
                    required
                  />
                </div>
                <div className="merchantField">
                  <label>Reference (optional)</label>
                  <input
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="e.g. branch-a-desk-01"
                  />
                </div>
              </div>
              {!activeLocations.length ? (
                <div className="merchantError">Activate or create a location before adding review cards.</div>
              ) : null}
              {error ? (
                <div className="merchantError" role="alert">
                  {error}
                </div>
              ) : null}
              <div className="merchantFormActions">
                <button className="merchantBtn" disabled={loading || Boolean(updatingId) || !locationId}>
                  {loading ? "Creating…" : "Create card link"}
                </button>
              </div>
            </form>
          ) : null}

          <section className="merchantCard merchantSectionCard nfcSetupInfo" aria-label="How to activate an NFC card">
            <div className="merchantSectionHead">
              <div>
                <span className="merchantEyebrow">NFC CARD SETUP</span>
                <h2>Tap to open your Google Review experience</h2>
                <p>
                  Cards need no battery or special customer app. Open this dashboard on your permanent production HTTPS domain
                  before copying a tag URL — never program a localhost or preview link.
                </p>
              </div>
            </div>
            <div className="nfcSetupSteps">
              <div>
                <span>01</span>
                <strong>Create a card link</strong>
                <p>Use one unique touchpoint per physical card, for example Reception Card 01.</p>
              </div>
              <div>
                <span>02</span>
                <strong>Program the tag</strong>
                <p>Tap “Copy NFC URL” below. In an NFC writing app, write it as a URL/URI NDEF record.</p>
              </div>
              <div>
                <span>03</span>
                <strong>Test before printing</strong>
                <p>Tap with an unlocked NFC-capable phone. Confirm the review page opens over HTTPS.</p>
              </div>
            </div>
          </section>

          <section className="merchantCard merchantTableCard">
            <div className="merchantTableHead">
              <h2>Digital Touchpoints &amp; QR backups</h2>
              <span className="merchantPill">{qrCodes.length} total</span>
            </div>
            {qrCodes.length ? (
              <table className="merchantTable">
                <thead>
                  <tr>
                    <th>Card / touchpoint</th>
                    <th>Location</th>
                    <th>NFC destination</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {qrCodes.map((qr) => (
                    <tr key={qr.id}>
                      <td>
                        <strong>{qr.name}</strong>
                        <small>
                          {qr.sourceType}
                          {qr.reference ? ` · ${qr.reference}` : ""}
                        </small>
                      </td>
                      <td>
                        <strong>{qr.locationName}</strong>
                      </td>
                      <td>
                        <span className="merchantQrLink">/n/{qr.publicToken}</span>
                        <small>QR backup: /r/{qr.publicToken}</small>
                      </td>
                      <td>
                        <span className={`merchantStatus ${qr.isActive ? "" : "off"}`}>
                          {qr.isActive ? "Active" : "Paused"}
                        </span>
                      </td>
                      <td>
                        <div className="merchantActions">
                          <button
                            type="button"
                            onClick={() => {
                              const link = `${window.location.origin}/n/${encodeURIComponent(qr.publicToken)}`;
                              void handleCopy(link, `${qr.id}-nfc`);
                            }}
                          >
                            {copied === `${qr.id}-nfc` ? "Copied!" : "Copy NFC URL"}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              window.open(`/n/${encodeURIComponent(qr.publicToken)}`, "_blank", "noopener,noreferrer")
                            }
                          >
                            Test link
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const link = `${window.location.origin}/r/${encodeURIComponent(qr.publicToken)}`;
                              void handleCopy(link, `${qr.id}-qr`);
                            }}
                          >
                            {copied === `${qr.id}-qr` ? "Copied!" : "Copy QR URL"}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              window.open(`/api/v1/merchant/qr-codes/${qr.id}/svg`, "_blank", "noopener,noreferrer")
                            }
                          >
                            View QR
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              window.open(
                                `/api/v1/merchant/qr-codes/${qr.id}/svg?download=1`,
                                "_blank",
                                "noopener,noreferrer",
                              )
                            }
                          >
                            Download
                          </button>
                          {canWrite ? (
                            <button
                              type="button"
                              disabled={Boolean(updatingId)}
                              onClick={() => void toggle(qr)}
                            >
                              {updatingId === qr.id ? "Updating…" : qr.isActive ? "Pause" : "Activate"}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="merchantEmpty">No review links yet. Create your first NFC-ready card above.</div>
            )}
          </section>
        </>
      )}

      {/* ------------------------------------------------------------------
          POPUP MODAL: BATCH GENERATE STANDEES
          ------------------------------------------------------------------ */}
      {isBatchModalOpen ? (
        <div className={styles.modalOverlay} onClick={() => setIsBatchModalOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Generate Pre-Printed Standees Batch</h3>
            <p className={styles.modalSub}>
              Mint unique standee tokens to print on physical acrylic standees in advance. Take them to market and
              activate on the spot!
            </p>

            <form onSubmit={handleCreateBatch}>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Quantity to Generate</label>
                <div className={styles.presetCountGroup}>
                  {[10, 20, 50, 100].map((num) => (
                    <button
                      key={num}
                      type="button"
                      className={`${styles.presetCountBtn} ${batchCount === num ? styles.presetCountBtnActive : ""}`}
                      onClick={() => setBatchCount(num)}
                    >
                      {num} Units
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min={1}
                  max={250}
                  className={styles.formInput}
                  value={batchCount}
                  onChange={(e) => setBatchCount(Math.max(1, Math.min(250, Number(e.target.value))))}
                  placeholder="Custom count e.g. 100"
                  required
                />
                <small style={{ color: "#64748b", marginTop: "0.25rem", display: "block" }}>
                  Select 100 for a full wholesale printing stock.
                </small>
              </div>

              <div className={styles.formField}>
                <label className={styles.formLabel}>Standee Code Prefix</label>
                <input
                  className={styles.formInput}
                  value={batchPrefix}
                  onChange={(e) => setBatchPrefix(e.target.value.toUpperCase())}
                  placeholder="e.g. ST-"
                  required
                />
                <small style={{ color: "#64748b", marginTop: "0.25rem", display: "block" }}>
                  Codes will follow sequence: {batchPrefix}011, {batchPrefix}012, etc.
                </small>
              </div>

              <div className={styles.formField}>
                <label className={styles.formLabel}>Batch Name / Memo</label>
                <input
                  className={styles.formInput}
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  placeholder="e.g. October Acrylic Batch #1"
                  required
                />
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.modalCancelBtn}
                  onClick={() => setIsBatchModalOpen(false)}
                  disabled={batchLoading}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.modalSubmitBtn} disabled={batchLoading}>
                  {batchLoading ? "Minting Batch..." : `Mint ${batchCount} Standees`}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* ------------------------------------------------------------------
          POPUP MODAL: QUICK ASSIGN STANDEE TO MERCHANT
          ------------------------------------------------------------------ */}
      {assigningStandee ? (
        <div className={styles.modalOverlay} onClick={() => setAssigningStandee(null)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>
              Assign Standee {assigningStandee.standeeCode} to Merchant
            </h3>
            <p className={styles.modalSub}>
              Select the client business. This pre-printed standee will immediately route to their Google Review page.
            </p>

            <form onSubmit={handleAssignStandee}>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Choose Active Client Merchant</label>
                <select
                  className={styles.formSelect}
                  value={targetLocationId}
                  onChange={(e) => setTargetLocationId(e.target.value)}
                  required
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.publicId})
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.modalCancelBtn}
                  onClick={() => setAssigningStandee(null)}
                  disabled={assignLoading}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.modalSubmitBtn} disabled={assignLoading || !targetLocationId}>
                  {assignLoading ? "Binding..." : "Bind Standee Now"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* ------------------------------------------------------------------
          POPUP MODAL: STANDEE PREVIEW
          ------------------------------------------------------------------ */}
      {previewStandee ? (
        <StandeePreviewModal
          standeeCode={previewStandee.standeeCode}
          publicToken={previewStandee.publicToken}
          standeeId={previewStandee.id}
          locationName={previewStandee.locationName}
          isAssigned={previewStandee.status === "assigned"}
          batchName={previewStandee.batchName}
          locations={locations}
          onClose={() => setPreviewStandee(null)}
          onAssign={async (standeeId, locId) => {
            const res = await fetch("/api/v1/merchant/standees/assign", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                standeeId,
                locationId: locId,
                notes: "Assigned via Standee Preview Modal",
              }),
            });
            if (res.ok) {
              setPreviewStandee(null);
              router.refresh();
            }
          }}
        />
      ) : null}
    </div>
  );
}
