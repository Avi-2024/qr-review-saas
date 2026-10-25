"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { StandeeStatus } from "@/server/merchant/domain/merchant";
import styles from "./BulkPrintStudio.module.css";

export interface PrintableStandee {
  id: string;
  standeeCode: string;
  publicToken: string;
  status: StandeeStatus;
  locationName?: string | null;
  batchName: string;
  qrDataUrl: string;
}

function GoogleColoredIcon() {
  return (
    <svg className={styles.googleGIcon} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

function GoogleStarIcon() {
  return (
    <svg className={styles.starIcon} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
    </svg>
  );
}

function StandeeCard({
  standee,
  themeClass,
}: {
  standee: PrintableStandee;
  themeClass: string;
}) {
  const isAssigned = standee.status === "assigned";

  return (
    <div className={styles.standeeCardWrapper}>
      {/* Printer/Operator crop margin identifier (outside customer card face) */}
      <span className={styles.cropEdgeLabel} aria-hidden="true">
        ✂ CROP GUIDE • {standee.standeeCode} • {standee.batchName}
      </span>

      {/* The Actual Customer Standee Face */}
      <div className={`${styles.standeeCard} ${themeClass}`}>
        {/* Google Header Branding */}
        <div className={styles.brandRow}>
          <GoogleColoredIcon />
          <h3 className={styles.headerTitle}>Review us on Google</h3>
        </div>

        {/* 5 Google Gold Stars */}
        <div className={styles.starsContainer} aria-hidden="true">
          {[...Array(5)].map((_, i) => (
            <GoogleStarIcon key={i} />
          ))}
        </div>

        {/* Merchant Business Name (Only if specifically assigned to a client shop) */}
        {isAssigned && standee.locationName ? (
          <div className={styles.merchantName}>{standee.locationName}</div>
        ) : null}

        {/* Clean, natural instruction mentioning AI without clunky boxes */}
        <div className={styles.subtext}>Scan with camera for instant AI review</div>

        {/* QR Code */}
        <div className={styles.qrCard}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={standee.qrDataUrl}
            alt={`QR code for ${standee.standeeCode}`}
            className={styles.qrImage}
          />
        </div>

        {/* Clean, high-converting footer note */}
        <div className={styles.footerAiNote}>
          <span className={styles.sparkleAi} aria-hidden="true">✨</span>
          <span>1-Tap AI • No typing needed</span>
        </div>

        {/* Google 4-Color Accent Line */}
        <div className={styles.googleColorBar} aria-hidden="true">
          <span className={styles.colorBarBlue} />
          <span className={styles.colorBarRed} />
          <span className={styles.colorBarYellow} />
          <span className={styles.colorBarGreen} />
        </div>

        <div className={styles.footerSubNote}>Direct to Google Form</div>
      </div>
    </div>
  );
}

export default function BulkPrintStudio({
  standees,
  initialFilter = "unassigned",
}: {
  standees: PrintableStandee[];
  initialFilter?: "unassigned" | "all" | "assigned";
}) {
  const [filter, setFilter] = useState<"unassigned" | "all" | "assigned">(initialFilter);
  const [layout, setLayout] = useState<"a4_duo" | "a6_single">("a4_duo");
  const [theme, setTheme] = useState<"crystal" | "obsidian" | "navy">("crystal");

  // Keep full-screen focus and remove dashboard navigation dock while in print studio
  useEffect(() => {
    document.body.classList.add("print-studio-active");
    return () => {
      document.body.classList.remove("print-studio-active");
    };
  }, []);

  // Keyboard shortcut Ctrl+P / Cmd+P listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        window.print();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Filtered Standees list
  const filteredStandees = useMemo(() => {
    if (filter === "unassigned") return standees.filter((s) => s.status === "unassigned");
    if (filter === "assigned") return standees.filter((s) => s.status === "assigned");
    return standees;
  }, [standees, filter]);

  // Group standees into pages based on layout
  const pages = useMemo(() => {
    if (layout === "a6_single") {
      return filteredStandees.map((st) => [st]);
    }
    // a4_duo: 2 per page
    const chunks: PrintableStandee[][] = [];
    for (let i = 0; i < filteredStandees.length; i += 2) {
      chunks.push(filteredStandees.slice(i, i + 2));
    }
    return chunks;
  }, [filteredStandees, layout]);

  const themeClass =
    theme === "crystal"
      ? styles.themeCrystal
      : theme === "obsidian"
      ? styles.themeObsidian
      : styles.themeNavy;

  return (
    <div className={styles.workbench}>
      {/* ------------------------------------------------------------------
          STICKY TOP CONTROL BAR (Screen Only)
          ------------------------------------------------------------------ */}
      <header className={styles.stickyBar}>
        <div className={styles.barContent}>
          {/* Left: Back & Title */}
          <div className={styles.barLeft}>
            <Link href="/dashboard/qr-codes" className={styles.backBtn}>
              ← Back to Inventory
            </Link>
            <div className={styles.titleGroup}>
              <div className={styles.barTitle}>
                Bulk Standee Print &amp; PDF Studio
                <span className={styles.barBadge}>Print Ready</span>
              </div>
              <div className={styles.barSub}>
                {filteredStandees.length} Standees • {pages.length} {layout === "a4_duo" ? "A4 Sheets" : "4\"×6\" Pages"}
              </div>
            </div>
          </div>

          {/* Center: Controls (Filter, Layout, Theme) */}
          <div className={styles.controlsGroup}>
            {/* Filter */}
            <div className={styles.controlItem}>
              <span className={styles.controlLabel}>Stock:</span>
              <select
                className={styles.controlSelect}
                value={filter}
                onChange={(e) => setFilter(e.target.value as "unassigned" | "all" | "assigned")}
              >
                <option value="unassigned">In-Stock Only ({standees.filter((s) => s.status === "unassigned").length})</option>
                <option value="all">All Standees ({standees.length})</option>
                <option value="assigned">Deployed Only ({standees.filter((s) => s.status === "assigned").length})</option>
              </select>
            </div>

            {/* Layout */}
            <div className={styles.controlItem}>
              <span className={styles.controlLabel}>Sheet:</span>
              <select
                className={styles.controlSelect}
                value={layout}
                onChange={(e) => setLayout(e.target.value as "a4_duo" | "a6_single")}
              >
                <option value="a4_duo">A4 Sheet (2 Cards / Page - Fit 4"×6" Stand)</option>
                <option value="a6_single">4" × 6" Direct (1 Card / Page - Exact 4"×6" Stand)</option>
              </select>
            </div>

            {/* Theme */}
            <div className={styles.controlItem}>
              <span className={styles.controlLabel}>Theme:</span>
              <select
                className={styles.controlSelect}
                value={theme}
                onChange={(e) => setTheme(e.target.value as "crystal" | "obsidian" | "navy")}
              >
                <option value="crystal">⚪ Crystal White (Ink Saver / Print Shop)</option>
                <option value="obsidian">⚫ Obsidian Black (Gloss Dark)</option>
                <option value="navy">🔵 Navy Blue (Corporate)</option>
              </select>
            </div>

            {/* Print / Save PDF Button */}
            <button
              type="button"
              className={styles.primaryPrintBtn}
              onClick={() => window.print()}
            >
              🖨️ Print / Save as PDF
            </button>
          </div>
        </div>
      </header>

      {/* Dynamic @page sizing rule based on selected layout */}
      {layout === "a4_duo" ? (
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @media print {
                @page {
                  size: A4 portrait;
                  margin: 6mm 8mm;
                }
              }
            `,
          }}
        />
      ) : (
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @media print {
                @page {
                  size: 102mm 152mm;
                  margin: 4mm;
                }
              }
            `,
          }}
        />
      )}

      {/* ------------------------------------------------------------------
          PRINT SHOP HELPER BANNER (Screen Only)
          ------------------------------------------------------------------ */}
      <aside className={styles.tipBanner} aria-label="Printing instructions">
        <div className={styles.tipList}>
          <div className={styles.tipItem}>
            <span>📄</span>
            <span>
              Destination: <strong className={styles.tipHighlight}>Save as PDF</strong> in browser print dialog
            </span>
          </div>
          <div className={styles.tipItem}>
            <span>🎨</span>
            <span>
              Options: Enable <strong className={styles.tipHighlight}>Background Graphics: ON</strong>
            </span>
          </div>
          <div className={styles.tipItem}>
            <span>📏</span>
            <span>
              Paper: <strong className={styles.tipHighlight}>{layout === "a4_duo" ? "A4 (2 Cards per Sheet)" : "4\" × 6\" (100 × 150 mm)"}</strong>
            </span>
          </div>
        </div>
        <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
          Shortcuts: <kbd style={{ background: "#334155", padding: "2px 6px", borderRadius: "4px" }}>Ctrl + P</kbd>
        </div>
      </aside>

      {/* ------------------------------------------------------------------
          PRINT PREVIEW SHEETS STAGE
          ------------------------------------------------------------------ */}
      <main className={styles.sheetStage}>
        {pages.length > 0 ? (
          pages.map((pageStandees, pageIdx) => {
            const pageNumber = pageIdx + 1;

            if (layout === "a6_single") {
              const standee = pageStandees[0];
              return (
                <section
                  key={standee.id}
                  className={`${styles.pageSheet} ${styles.pageA6}`}
                  aria-label={`Page ${pageNumber} of ${pages.length}`}
                >
                  <div className={styles.pageHeaderInfo}>
                    <span>4" × 6" Acrylic Stand Insert • {standee.standeeCode}</span>
                    <span>Sheet {pageNumber} / {pages.length}</span>
                  </div>

                  <StandeeCard
                    standee={standee}
                    themeClass={themeClass}
                  />

                  <div className={styles.pageFooterInfo}>
                    <span>300 DPI Vector QR • Pre-Printed Batch: {standee.batchName}</span>
                  </div>
                </section>
              );
            }

            // Layout A4 Duo: 2 Standees per page with dashed cut-guide
            return (
              <section
                key={`page-${pageIdx}`}
                className={`${styles.pageSheet} ${styles.pageA4}`}
                aria-label={`Sheet ${pageNumber} of ${pages.length}`}
              >
                <div className={styles.pageHeaderInfo}>
                  <span>A4 Dual 4" × 6" Acrylic Insert Sheet</span>
                  <span>Sheet {pageNumber} of {pages.length}</span>
                </div>

                <div className={styles.a4DuoGrid}>
                  {/* Top Standee */}
                  {pageStandees[0] ? (
                    <div className={styles.a4DuoRow}>
                      <StandeeCard
                        standee={pageStandees[0]}
                        themeClass={themeClass}
                      />
                    </div>
                  ) : null}

                  {/* Cut Guide Divider between Card 1 and Card 2 */}
                  {pageStandees.length > 1 ? (
                    <div className={styles.cutGuideDivider} aria-hidden="true">
                      <span className={styles.cutLine} />
                      <span className={styles.cutIcon}>✂ CUT HERE ✂</span>
                      <span className={styles.cutLine} />
                    </div>
                  ) : null}

                  {/* Bottom Standee */}
                  {pageStandees[1] ? (
                    <div className={styles.a4DuoRow}>
                      <StandeeCard
                        standee={pageStandees[1]}
                        themeClass={themeClass}
                      />
                    </div>
                  ) : null}
                </div>

                <div className={styles.pageFooterInfo}>
                  <span>Pre-Printed Acrylic Standees Stock • Fit for 4" × 6" (100 × 150 mm) counter stands</span>
                  <span>Print on 250-350 GSM Glossy Cardstock</span>
                </div>
              </section>
            );
          })
        ) : (
          <div style={{ textAlign: "center", padding: "4rem 2rem", color: "#94a3b8" }}>
            No standees match the selected filter.
          </div>
        )}
      </main>
    </div>
  );
}