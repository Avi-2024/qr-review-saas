"use client";

import { useMemo, useState } from "react";
import type { MerchantIdentity, StandeeItem } from "@/server/merchant/domain/merchant";
import AgentQrConfigModal from "./AgentQrConfigModal";
import styles from "./AgentFieldPortal.module.css";

const PAYOUT_PER_STANDEE = 250;

export default function AgentFieldPortal({
  identity,
  initialStandees,
}: {
  identity: MerchantIdentity;
  initialStandees: StandeeItem[];
}) {
  const [standees, setStandees] = useState<StandeeItem[]>(initialStandees);
  const [searchQuery, setSearchQuery] = useState("");
  const [configuringStandee, setConfiguringStandee] = useState<StandeeItem | null>(null);

  const installedCount = standees.length;
  const totalPayout = installedCount * PAYOUT_PER_STANDEE;

  const filteredStandees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return standees;
    return standees.filter(
      (s) =>
        s.standeeCode.toLowerCase().includes(q) ||
        (s.locationName && s.locationName.toLowerCase().includes(q)),
    );
  }, [standees, searchQuery]);

  async function handleLogout() {
    try {
      await fetch("/api/v1/merchant/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  }

  return (
    <div className={styles.shell}>
      {/* Topbar */}
      <header className={styles.topbar}>
        <div className={styles.brandGroup}>
          <span className={styles.brandLogo}>⚡</span>
          <div className={styles.brandText}>
            <span className={styles.brandTitle}>{identity.organizationName}</span>
            <span className={styles.brandSubtitle}>Field Agent Portal</span>
          </div>
        </div>

        <div className={styles.userGroup}>
          <span className={styles.agentPill}>👤 {identity.name}</span>
          <button type="button" className={styles.logoutBtn} onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className={styles.mainContainer}>
        {/* Earnings & Incentives Hero Card */}
        <section className={styles.earningsHero}>
          <div className={styles.earningsHeader}>
            <div>
              <span className={styles.earningsSubtitle}>Total Earnings &amp; Payout</span>
              <h1 className={styles.earningsAmount}>
                ₹{new Intl.NumberFormat("en-IN").format(totalPayout)}
              </h1>
            </div>
            <div className={styles.ratePill}>
              ⚡ ₹{PAYOUT_PER_STANDEE} / installation
            </div>
          </div>

          <div className={styles.earningsMetaRow}>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Counters Installed By You</span>
              <strong className={styles.metaValue}>{installedCount} Standees</strong>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Payout Status</span>
              <strong className={styles.metaValue} style={{ color: "#34d399" }}>
                Active • Approved
              </strong>
            </div>
          </div>
        </section>

        {/* How to Install & Earn ₹250 (1-Step Camera Scan) */}
        <section className={styles.scanCalloutCard}>
          <div className={styles.scanCalloutIcon}>📲</div>
          <div className={styles.scanCalloutBody}>
            <strong className={styles.scanCalloutTitle}>
              Kaise Install Karein (Seedha Phone Camera Se)
            </strong>
            <p className={styles.scanCalloutDesc}>
              Market me bag se physical standee nikaal kar dukan ke counter par rakhein aur <strong>apne phone camera se standee ka QR scan karein</strong>. Google Maps par shop tap karte hi standee 5 second me bind ho jayega aur aapke dashboard me turant <strong>+₹250 add</strong> ho jayenge!
            </p>
            <div className={styles.scanCalloutActions}>
              <a
                href="/r/st-002"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.tryScanBtn}
              >
                ⚡ Test Standee Camera Scan (/r/st-002) ↗
              </a>
            </div>
          </div>
        </section>

        {/* My Deployed Counters List (Only installed by this agent!) */}
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
              <h2 className={styles.sectionTitle}>
                <span>📍</span> My Installed Standees ({installedCount})
              </h2>
              <span style={{ fontSize: "0.8125rem", color: "#059669", fontWeight: "700" }}>
                Showing only your installations
              </span>
            </div>
            <p className={styles.sectionSub}>
              List of all physical standees placed and activated on merchant counters by you. Configure topics &amp; SEO for each.
            </p>
          </div>

          {/* Search bar */}
          {installedCount > 0 ? (
            <div style={{ marginBottom: "1rem" }}>
              <input
                type="search"
                className={styles.fieldInput}
                placeholder="🔍 Search by shop name or standee code (e.g. ST-002)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          ) : null}

          {installedCount === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>📦</div>
              <h3 className={styles.emptyTitle}>Abhi tak koi standee install nahi hua</h3>
              <p className={styles.emptyDesc}>
                Market me dukan counter par standee rakhein aur phone camera se standee ka QR scan karke activate karein. Har installation par aapko <strong>₹250</strong> milenge!
              </p>
            </div>
          ) : filteredStandees.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "#64748b", fontSize: "0.875rem" }}>
              No standees found matching &quot;{searchQuery}&quot;.
            </div>
          ) : (
            <div className={styles.shopList}>
              {filteredStandees.map((st) => (
                <div key={st.id} className={styles.shopCard}>
                  <div className={styles.shopInfo}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                      <span className={styles.shopName}>
                        {st.locationName || "Client Merchant"}
                      </span>
                      <span className={styles.standeeCodeBadge}>
                        💎 {st.standeeCode}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem", flexWrap: "wrap" }}>
                      <span className={styles.earningBadge}>
                        💰 +₹{PAYOUT_PER_STANDEE} Earned
                      </span>
                      {st.assignedAt ? (
                        <span className={styles.dateText}>
                          Installed on {new Date(st.assignedAt).toLocaleDateString()}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className={styles.shopActions}>
                    {st.locationId ? (
                      <button
                        type="button"
                        className={styles.configBtn}
                        onClick={() => setConfiguringStandee(st)}
                      >
                        ⚙️ Configure Topics &amp; QR
                      </button>
                    ) : null}
                    <a
                      href={`/r/${st.publicToken}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.testFlowBtn}
                    >
                      Test QR Flow ↗
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* QR Configuration Modal */}
      {configuringStandee ? (
        <AgentQrConfigModal
          standee={configuringStandee}
          onClose={() => setConfiguringStandee(null)}
          onSaved={() => {
            setConfiguringStandee(null);
          }}
        />
      ) : null}
    </div>
  );
}
