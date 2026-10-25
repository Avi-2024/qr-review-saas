"use client";

import { useEffect, useState } from "react";
import type { MerchantLocation } from "@/server/merchant/domain/merchant";
import styles from "./StandeePreviewModal.module.css";

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

async function copyText(value: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* fallback */
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

export default function StandeePreviewModal({
  standeeCode,
  publicToken,
  standeeId,
  locationName,
  isAssigned,
  batchName,
  locations = [],
  onClose,
  onAssign,
}: {
  standeeCode: string;
  publicToken: string;
  standeeId?: string;
  locationName?: string | null;
  isAssigned: boolean;
  batchName?: string;
  locations?: MerchantLocation[];
  onClose: () => void;
  onAssign?: (standeeId: string, locationId: string) => Promise<void>;
}) {
  // Theme styling switcher: obsidian, crystal, navy
  const [theme, setTheme] = useState<"obsidian" | "crystal" | "navy">("obsidian");
  const [copied, setCopied] = useState(false);
  const [selectedLocId, setSelectedLocId] = useState(locations[0]?.id || "");
  const [assignLoading, setAssignLoading] = useState(false);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const fullUrl = typeof window !== "undefined"
    ? `${window.location.origin}/r/${publicToken}`
    : `/r/${publicToken}`;

  const qrImageUrl = standeeId
    ? `/api/v1/merchant/standees/${standeeId}/svg`
    : `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(fullUrl)}`;

  const downloadSvgUrl = standeeId
    ? `/api/v1/merchant/standees/${standeeId}/svg?download=1`
    : qrImageUrl;

  async function handleCopy() {
    if (await copyText(fullUrl)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }

  async function handleAssignSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!standeeId || !selectedLocId || !onAssign || assignLoading) return;
    setAssignLoading(true);
    try {
      await onAssign(standeeId, selectedLocId);
    } finally {
      setAssignLoading(false);
    }
  }

  const themeClass =
    theme === "obsidian"
      ? styles.themeObsidian
      : theme === "crystal"
      ? styles.themeCrystal
      : styles.themeNavy;

  return (
    <div className={styles.modalBackdrop} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modalWindow} onClick={(e) => e.stopPropagation()}>
        {/* Top Header */}
        <header className={styles.modalTopbar}>
          <div className={styles.topbarTitleGroup}>
            <span className={styles.eyebrow}>
              STAND INVENTORY • {standeeCode} {isAssigned ? "• ACTIVE ON COUNTER" : "• READY TO BIND"}
            </span>
            <h2 className={styles.title}>Physical Counter Standee</h2>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close Standee Mockup"
          >
            ✕
          </button>
        </header>

        {/* Modal Body */}
        <div className={styles.modalBody}>
          {/* Spec & Theme Switcher */}
          <div className={styles.toolbarStrip}>
            <div className={styles.specPills}>
              <span className={styles.specBadge}>📐 A6 (105 × 148 mm)</span>
              <span className={styles.specBadge}>💎 Laser Acrylic</span>
              <span className={styles.specBadge}>⚡ Vector 300 DPI</span>
            </div>

            <div className={styles.themeSelector} aria-label="Choose standee theme">
              <button
                type="button"
                className={`${styles.themeButton} ${theme === "obsidian" ? styles.themeButtonActive : ""}`}
                onClick={() => setTheme("obsidian")}
              >
                🖤 Obsidian
              </button>
              <button
                type="button"
                className={`${styles.themeButton} ${theme === "crystal" ? styles.themeButtonActive : ""}`}
                onClick={() => setTheme("crystal")}
              >
                🤍 Crystal
              </button>
              <button
                type="button"
                className={`${styles.themeButton} ${theme === "navy" ? styles.themeButtonActive : ""}`}
                onClick={() => setTheme("navy")}
              >
                💙 Navy
              </button>
            </div>
          </div>

          {/* 3D Physical Standee Stage */}
          <div className={styles.standeeStage}>
            {/* The Acrylic Plate */}
            <div className={`${styles.standeePlate} ${themeClass}`}>
              {/* Google Header Branding */}
              <div className={styles.googleBrandRow}>
                <GoogleColoredIcon />
                <span className={styles.standeeHeaderTitle}>Review us on Google</span>
              </div>

              {/* 5 Authentic Google Vector Gold Stars */}
              <div className={styles.starsContainer} aria-hidden="true">
                {[...Array(5)].map((_, i) => (
                  <GoogleStarIcon key={i} />
                ))}
              </div>

              {/* Client Merchant Title (Only if assigned to a shop) */}
              {isAssigned && locationName ? (
                <div className={styles.merchantTitle}>{locationName}</div>
              ) : null}

              {/* Clean, natural instruction mentioning AI without clunky boxes */}
              <div className={styles.standeeSubtext}>
                Scan with camera for instant AI review
              </div>

              {/* QR Code Container */}
              <div className={styles.qrCardWrap}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrImageUrl}
                  alt={`High resolution vector QR code for Standee ${standeeCode}`}
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

            {/* 3D Slotted Counter Stand Base Foot */}
            <div className={styles.acrylicStandBase} aria-hidden="true" />
            <div className={styles.acrylicStandShadow} aria-hidden="true" />
          </div>

          {/* Direct Link Box */}
          <div className={styles.linkBar}>
            <span className={styles.linkUrlText}>{fullUrl}</span>
            <button
              type="button"
              className={`${styles.copySmallBtn} ${copied ? styles.copySmallBtnCopied : ""}`}
              onClick={handleCopy}
            >
              {copied ? "Copied ✓" : "Copy Link"}
            </button>
            <a
              href={`/r/${publicToken}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.copySmallBtn}
            >
              Test Live ↗
            </a>
          </div>

          {/* Quick Assign Box if Standee is Unassigned */}
          {!isAssigned && onAssign && locations.length > 0 ? (
            <form onSubmit={handleAssignSubmit} className={styles.quickAssignBox}>
              <select
                className={styles.quickAssignSelect}
                value={selectedLocId}
                onChange={(e) => setSelectedLocId(e.target.value)}
                disabled={assignLoading}
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    Assign to: {loc.name} ({loc.publicId})
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className={styles.quickAssignConfirmBtn}
                disabled={assignLoading || !selectedLocId}
              >
                {assignLoading ? "Binding..." : "⚡ Bind to Shop"}
              </button>
            </form>
          ) : null}
        </div>

        {/* Modal Action Footer */}
        <footer className={styles.modalFooter}>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => window.print()}
            >
              🖨️ Print Standee
            </button>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={onClose}
            >
              Close
            </button>
          </div>

          <a
            href={downloadSvgUrl}
            className={styles.downloadSvgBtn}
            download={`${standeeCode}.svg`}
          >
            ⬇ Download Print-Ready SVG
          </a>
        </footer>
      </div>
    </div>
  );
}
