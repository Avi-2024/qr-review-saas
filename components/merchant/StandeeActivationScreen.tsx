"use client";

import { useState } from "react";
import GooglePlacePicker from "@/components/merchant/GooglePlacePicker";
import type { MerchantIdentity, MerchantLocation, StandeeItem } from "@/server/merchant/domain/merchant";
import styles from "./StandeeActivationScreen.module.css";

export default function StandeeActivationScreen({
  standee,
  identity,
  locations,
  placesSearchEnabled,
}: {
  standee: StandeeItem;
  identity: MerchantIdentity | null;
  locations: MerchantLocation[];
  placesSearchEnabled: boolean;
}) {
  // If user is not logged in: quick login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // If user is logged in: activation tabs ('new' vs 'existing')
  const [activeTab, setActiveTab] = useState<"new" | "existing">("new");

  // New Merchant Form
  const [businessName, setBusinessName] = useState("");
  const [subtitle, setSubtitle] = useState("Share your experience in a few taps.");
  const [googlePlaceId, setGooglePlaceId] = useState("");

  // Existing Merchant Pick
  const [selectedLocationId, setSelectedLocationId] = useState(locations[0]?.id || "");

  // Common UI states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<string | null>(null);

  // Handle Super Admin Quick Login
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!loginEmail || !loginPassword || loginLoading) return;

    setLoginLoading(true);
    setError("");
    try {
      const res = await fetch("/api/v1/merchant/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error?.message || "Invalid Super Admin credentials.");
      }
      // Refresh to load identity
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
      setLoginLoading(false);
    }
  }

  // Handle Activating for NEW Merchant
  async function handleRegisterAndActivate(e: React.FormEvent) {
    e.preventDefault();
    if (!businessName.trim() || !googlePlaceId.trim() || loading) return;

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/v1/merchant/locations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: businessName.trim(),
          subtitle: subtitle.trim() || undefined,
          googlePlaceId,
          standeeId: standee.id,
          standeeCode: standee.standeeCode,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error?.message || "Could not activate standee for this business.");
      }

      setSuccess(`Standee ${standee.standeeCode} is now active for ${businessName}! Redirecting to live review screen...`);
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Activation failed.");
      setLoading(false);
    }
  }

  // Handle Linking to EXISTING Merchant
  async function handleLinkExisting(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedLocationId || loading) return;

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/v1/merchant/standees/assign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          standeeId: standee.id,
          locationId: selectedLocationId,
          notes: `Activated on-site via direct standee scan.`,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error?.message || "Could not link standee to merchant.");
      }

      const assignedLoc = locations.find((l) => l.id === selectedLocationId);
      setSuccess(`Standee ${standee.standeeCode} is now active for ${assignedLoc?.name || "Merchant"}! Redirecting...`);
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Binding failed.");
      setLoading(false);
    }
  }

  return (
    <main className={styles.pageWrapper}>
      <article className={styles.activationCard}>
        {/* Physical Standee Card Header */}
        <header className={styles.standeeVisualHeader}>
          <div className={styles.starsRow} aria-hidden="true">
            ⭐⭐⭐⭐⭐
          </div>
          <div>
            <span className={styles.standeeBadge}>Physical Counter Standee</span>
          </div>
          <h1 className={styles.standeeCode}>{standee.standeeCode}</h1>
          <div className={styles.statusIndicator}>
            <span className={styles.pulseDot} />
            Ready for On-Site Activation
          </div>
        </header>

        {/* Card Body */}
        <section className={styles.cardBody}>
          {success ? (
            <div className={styles.successCard}>
              <div className={styles.successIcon}>✓</div>
              <h2 className={styles.successTitle}>Standee Activated!</h2>
              <p className={styles.successText}>{success}</p>
            </div>
          ) : identity ? (
            /* Logged-in Admin View: On-the-spot Activation */
            <div>
              <h2 className={styles.bodyHeading}>Activate Standee on Counter</h2>
              <p className={styles.bodySubtitle}>
                Deploying for partner organization <strong>{identity.organizationName}</strong>. Link this standee code
                to a business in seconds.
              </p>

              {/* Tab Switcher */}
              <div className={styles.tabSwitcher}>
                <button
                  type="button"
                  className={`${styles.tabBtn} ${activeTab === "new" ? styles.tabBtnActive : ""}`}
                  onClick={() => setActiveTab("new")}
                >
                  + New Merchant
                </button>
                <button
                  type="button"
                  className={`${styles.tabBtn} ${activeTab === "existing" ? styles.tabBtnActive : ""}`}
                  onClick={() => setActiveTab("existing")}
                  disabled={!locations.length}
                >
                  Link Existing ({locations.length})
                </button>
              </div>

              {error && <div className={styles.errorMessage}>{error}</div>}

              {activeTab === "new" ? (
                <form onSubmit={handleRegisterAndActivate}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Search Google Place</label>
                    <GooglePlacePicker
                      enabled={placesSearchEnabled}
                      value={googlePlaceId}
                      onChange={setGooglePlaceId}
                      onSelectDetails={(details) => {
                        setGooglePlaceId(details.placeId);
                        if (details.mainText) setBusinessName(details.mainText);
                      }}
                      disabled={loading}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Business / Store Name</label>
                    <input
                      className={styles.formInput}
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="e.g. Sharma Sweets &amp; Bakery"
                      required
                      disabled={loading}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Customer Prompt Subtitle</label>
                    <input
                      className={styles.formInput}
                      value={subtitle}
                      onChange={(e) => setSubtitle(e.target.value)}
                      placeholder="e.g. Share your experience in a few taps."
                      disabled={loading}
                    />
                  </div>

                  <button
                    type="submit"
                    className={styles.activateBtn}
                    disabled={loading || !businessName.trim() || !googlePlaceId.trim()}
                  >
                    {loading ? "Activating Standee..." : `🚀 Activate Standee ${standee.standeeCode}`}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleLinkExisting}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Select Registered Business</label>
                    <select
                      className={styles.formSelect}
                      value={selectedLocationId}
                      onChange={(e) => setSelectedLocationId(e.target.value)}
                      required
                      disabled={loading}
                    >
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name} ({loc.publicId})
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    className={styles.activateBtn}
                    disabled={loading || !selectedLocationId}
                  >
                    {loading ? "Binding Standee..." : `🔗 Bind Standee ${standee.standeeCode}`}
                  </button>
                </form>
              )}
            </div>
          ) : (
            /* Not Logged In View: Agent Login Gate */
            <div>
              <h2 className={styles.bodyHeading}>Super Admin Activation</h2>
              <p className={styles.bodySubtitle}>
                This official Google Review Standee is awaiting activation. Sign in with your Super Admin credentials to
                bind it to a merchant counter right now.
              </p>

              {error && <div className={styles.errorMessage}>{error}</div>}

              <form onSubmit={handleLogin}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Admin Email</label>
                  <input
                    type="email"
                    className={styles.formInput}
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="admin@example.com"
                    required
                    disabled={loginLoading}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Admin Password</label>
                  <input
                    type="password"
                    className={styles.formInput}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    disabled={loginLoading}
                  />
                </div>

                <button
                  type="submit"
                  className={styles.activateBtn}
                  disabled={loginLoading || !loginEmail || !loginPassword}
                >
                  {loginLoading ? "Verifying..." : "Sign In & Deploy Standee"}
                </button>
              </form>
            </div>
          )}
        </section>
      </article>

      <footer className={styles.footerNote}>
        QR Review Platform · Secure Standee Dynamic Routing System
      </footer>
    </main>
  );
}
