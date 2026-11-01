"use client";

import { useEffect, useState } from "react";
import type { StandeeItem, MerchantTopicConfig } from "@/server/merchant/domain/merchant";
import { BUSINESS_PRESETS } from "@/lib/business-presets";
import styles from "./AgentQrConfigModal.module.css";

type TopicDraft = {
  id?: string;
  label: string;
  icon: string;
};

export default function AgentQrConfigModal({
  standee,
  onClose,
  onSaved,
}: {
  standee: StandeeItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [topics, setTopics] = useState<TopicDraft[]>([]);
  const [keywords, setKeywords] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      if (!standee.locationId) return;
      setLoading(true);
      setError("");

      try {
        const [topicsRes, locRes] = await Promise.all([
          fetch(`/api/v1/merchant/locations/${standee.locationId}/topics`, { cache: "no-store" }),
          fetch(`/api/v1/merchant/locations/${standee.locationId}`, { cache: "no-store" }),
        ]);

        const topicsData = await topicsRes.json().catch(() => null);
        const locData = await locRes.json().catch(() => null);

        if (cancelled) return;

        if (topicsRes.ok && topicsData?.data?.topics) {
          const raw = topicsData.data.topics as MerchantTopicConfig[];
          const activeOnly = raw
            .filter((t) => t.isActive)
            .map((t) => ({ id: t.id, label: t.label, icon: t.icon }));
          setTopics(activeOnly.length > 0 ? activeOnly : [
            { label: "Overall Quality", icon: "★" },
            { label: "Staff / Support", icon: "🤝" },
            { label: "Value / Pricing", icon: "◎" },
            { label: "Ease / Convenience", icon: "✓" },
          ]);
        }

        if (locRes.ok && locData?.data?.location) {
          setKeywords(locData.data.location.keywords || "");
          setSubtitle(locData.data.location.subtitle || "Share your experience in a few taps.");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load standee details.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, [standee.locationId]);

  function handleApplyPreset(presetTopics: Array<{ label: string; icon: string }>) {
    setTopics(presetTopics.map((t) => ({ label: t.label, icon: t.icon })));
    setError("");
  }

  function handleUpdateTopic(index: number, patch: Partial<TopicDraft>) {
    setTopics((prev) =>
      prev.map((t, i) => (i === index ? { ...t, ...patch } : t)),
    );
    setError("");
  }

  function handleMoveTopic(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= topics.length) return;
    setTopics((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[target];
      next[target] = temp;
      return next;
    });
  }

  function handleRemoveTopic(index: number) {
    if (topics.length <= 3) {
      setError("At least 3 review topics are required.");
      return;
    }
    setTopics((prev) => prev.filter((_, i) => i !== index));
    setError("");
  }

  function handleAddTopic() {
    if (topics.length >= 8) {
      setError("Maximum 8 review topics allowed.");
      return;
    }
    setTopics((prev) => [...prev, { label: "", icon: "★" }]);
    setError("");
  }

  async function handleSave() {
    if (!standee.locationId) return;

    // Validation
    const cleanTopics = topics.map((t) => ({
      ...t,
      label: t.label.trim(),
      icon: t.icon.trim() || "★",
    }));

    if (cleanTopics.some((t) => !t.label)) {
      setError("All topic labels must be filled.");
      return;
    }

    if (cleanTopics.length < 3 || cleanTopics.length > 8) {
      setError("Keep between 3 and 8 active review topics.");
      return;
    }

    const labels = cleanTopics.map((t) => t.label.toLowerCase());
    if (new Set(labels).size !== labels.length) {
      setError("Review topic labels must be unique.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      // 1. Save topics
      const topicsRes = await fetch(`/api/v1/merchant/locations/${standee.locationId}/topics`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topics: cleanTopics }),
      });
      const topicsJson = await topicsRes.json().catch(() => null);
      if (!topicsRes.ok || !topicsJson?.success) {
        throw new Error(topicsJson?.error?.message || "Failed to save review topics.");
      }

      // 2. Save location keywords & subtitle
      const locRes = await fetch(`/api/v1/merchant/locations/${standee.locationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords: keywords.trim(),
          subtitle: subtitle.trim(),
        }),
      });
      const locJson = await locRes.json().catch(() => null);
      if (!locRes.ok || !locJson?.success) {
        throw new Error(locJson?.error?.message || "Failed to update shop keywords.");
      }

      setSuccess(true);
      setTimeout(() => {
        onSaved();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save QR configuration.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.backdrop} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerInfo}>
            <div className={styles.headerTitle}>
              <span>⚙️ Configure QR &amp; Topics</span>
              <span className={styles.standeeCode}>💎 {standee.standeeCode}</span>
            </div>
            <p className={styles.headerSub}>
              {standee.locationName || "Merchant Counter"} • Customized for customer QR scans
            </p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} title="Close">
            ✕
          </button>
        </header>

        {/* Body */}
        <div className={styles.body}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "2.5rem 0", color: "#64748b" }}>
              Loading configuration...
            </div>
          ) : (
            <>
              {error ? <div className={styles.errorAlert}>⚠️ {error}</div> : null}
              {success ? (
                <div className={styles.successAlert}>
                  ✅ QR Configuration &amp; Topics saved successfully!
                </div>
              ) : null}

              {/* Section 1: Review Topics */}
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <h3 className={styles.sectionTitle}>
                    <span>🎯</span> Review Topics (Prompts)
                  </h3>
                  <span className={styles.sectionBadge}>
                    {topics.length} / 8 active (min 3)
                  </span>
                </div>
                <p className={styles.sectionHint}>
                  Customers tap 1–2 of these prompts before AI writes their review. Choose or edit prompts matching this shop.
                </p>

                {/* 1-Tap Category Presets */}
                <div style={{ marginTop: "0.25rem" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "0.35rem" }}>
                    ⚡ Quick 1-Tap Presets
                  </span>
                  <div className={styles.presetStrip}>
                    {BUSINESS_PRESETS.slice(0, 7).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={styles.presetBtn}
                        onClick={() => handleApplyPreset(p.topics)}
                        title={`Apply ${p.label} topics`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Active Topics List */}
                <div className={styles.topicsList}>
                  {topics.map((t, idx) => (
                    <div key={idx} className={styles.topicRow}>
                      <div className={styles.orderControls}>
                        <button
                          type="button"
                          className={styles.arrowBtn}
                          disabled={idx === 0}
                          onClick={() => handleMoveTopic(idx, -1)}
                          title="Move up"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          className={styles.arrowBtn}
                          disabled={idx === topics.length - 1}
                          onClick={() => handleMoveTopic(idx, 1)}
                          title="Move down"
                        >
                          ▼
                        </button>
                      </div>

                      <input
                        type="text"
                        className={styles.iconInput}
                        value={t.icon}
                        onChange={(e) => handleUpdateTopic(idx, { icon: e.target.value })}
                        maxLength={4}
                        title="Topic icon/emoji"
                      />

                      <input
                        type="text"
                        className={styles.labelInput}
                        value={t.label}
                        onChange={(e) => handleUpdateTopic(idx, { label: e.target.value })}
                        placeholder="e.g. Gold Purity, Food Taste, Staff..."
                      />

                      <button
                        type="button"
                        className={styles.deleteBtn}
                        onClick={() => handleRemoveTopic(idx)}
                        title="Remove topic"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}

                  {topics.length < 8 ? (
                    <button
                      type="button"
                      className={styles.addTopicBtn}
                      onClick={handleAddTopic}
                    >
                      + Add Topic
                    </button>
                  ) : null}
                </div>
              </section>

              {/* Section 2: SEO Focus Keywords */}
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>
                  <span>🔍</span> SEO Focus Keywords (AI Prompt Guidance)
                </h3>
                <p className={styles.sectionHint}>
                  These keywords will be organically blended by AI into 5-star Google reviews to boost local Google ranking.
                </p>
                <div className={styles.fieldGroup}>
                  <input
                    type="text"
                    className={styles.textInput}
                    placeholder="e.g. hallmark gold, bridal jewelry, best restaurant in town, polite staff"
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                  />
                  <span className={styles.fieldHint}>
                    Separate keywords with commas (e.g. &quot;hallmark 916, bridal jewelry, trusted&quot;)
                  </span>
                </div>
              </section>

              {/* Section 3: Customer Subtitle */}
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>
                  <span>💬</span> Customer Scan Greeting / Subtitle
                </h3>
                <p className={styles.sectionHint}>
                  Text displayed under the business name when a customer scans the physical QR.
                </p>
                <div className={styles.fieldGroup}>
                  <input
                    type="text"
                    className={styles.textInput}
                    placeholder="Share your experience in a few taps."
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                  />
                </div>
              </section>
            </>
          )}
        </div>

        {/* Footer */}
        <footer className={styles.footer}>
          <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={loading || saving || success}
          >
            {saving ? "Saving..." : success ? "Saved! ✓" : "💾 Save QR Configuration"}
          </button>
        </footer>
      </div>
    </div>
  );
}
