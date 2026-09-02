"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { polishText, type Rating } from "@/lib/review";
import {
  generateReviewDraft,
  recordReviewEvent,
  recordReviewEventOnExit,
  recordSessionEvent,
  ReviewApiError,
  startReviewSession,
  type LocationDto,
} from "@/lib/review-api";

const ratingLabels = ["", "Very poor", "Could be better", "Okay", "Good", "Excellent"];

function businessInitials(name?: string) {
  if (!name?.trim()) return "QR";
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return initials || "QR";
}

type ReviewExperienceProps = {
  qrToken?: string;
};

type PendingGeneration = {
  variation: number;
  requestId: string;
};

async function copyText(value: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Continue to the DOM fallback below.
  }

  let area: HTMLTextAreaElement | null = null;
  try {
    area = document.createElement("textarea");
    area.value = value;
    area.style.position = "fixed";
    area.style.opacity = "0";
    area.style.pointerEvents = "none";
    document.body.appendChild(area);
    area.focus();
    area.select();
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area?.remove();
  }
}

export default function ReviewExperience({ qrToken = "mangal-counter-demo" }: ReviewExperienceProps) {
  const [location, setLocation] = useState<LocationDto | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [rating, setRating] = useState<Rating | 0>(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [review, setReview] = useState("");
  const [variation, setVariation] = useState(0);
  const [screen, setScreen] = useState<"compose" | "review">("compose");
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  const qrTokenRef = useRef(qrToken);
  const sessionGenerationRef = useRef(0);
  const sessionIdRef = useRef<string | null>(null);
  const clientSessionIdRef = useRef<string | null>(null);
  const sessionPromiseRef = useRef<Promise<string> | null>(null);
  const pendingGenerationRef = useRef<PendingGeneration | null>(null);
  const editedDraftsRef = useRef(new Set<string>());

  const selectedCount = selected.length;
  const progress = screen === "review" ? 100 : rating ? 58 : 18;
  const contextLabel = useMemo(() => {
    if (!rating) return "Start with a rating";
    if (!selectedCount) return "Now add a few details";
    return `${selectedCount} detail${selectedCount === 1 ? "" : "s"} selected`;
  }, [rating, selectedCount]);

  useEffect(() => {
    if (qrTokenRef.current !== qrToken) {
      qrTokenRef.current = qrToken;
      sessionGenerationRef.current += 1;
      sessionIdRef.current = null;
      clientSessionIdRef.current = null;
      sessionPromiseRef.current = null;
      pendingGenerationRef.current = null;
      editedDraftsRef.current.clear();
      setLocation(null);
      setDraftId(null);
      setRating(0);
      setSelected([]);
      setNote("");
      setReview("");
      setVariation(0);
      setScreen("compose");
      setCopied(false);
      setError("");
    }

    void ensureSession().catch((cause) => {
      setError(cause instanceof Error ? cause.message : "Could not start the review session.");
    });
    // ensureSession uses refs as its source of truth, which avoids stale React state and Strict Mode duplicate sessions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrToken]);

  function getClientSessionId() {
    if (!clientSessionIdRef.current) clientSessionIdRef.current = crypto.randomUUID();
    return clientSessionIdRef.current;
  }

  async function ensureSession() {
    if (sessionIdRef.current) return sessionIdRef.current;
    if (sessionPromiseRef.current) return sessionPromiseRef.current;

    const tokenAtStart = qrTokenRef.current;
    const generationAtStart = sessionGenerationRef.current;
    const clientSessionId = getClientSessionId();

    const promise = startReviewSession(tokenAtStart, clientSessionId)
      .then((created) => {
        if (
          qrTokenRef.current === tokenAtStart &&
          sessionGenerationRef.current === generationAtStart
        ) {
          sessionIdRef.current = created.sessionId;
          setLocation(created.location);
        }
        return created.sessionId;
      })
      .finally(() => {
        if (sessionPromiseRef.current === promise) {
          sessionPromiseRef.current = null;
        }
      });

    sessionPromiseRef.current = promise;
    return promise;
  }

  async function renewSession() {
    sessionGenerationRef.current += 1;
    sessionIdRef.current = null;
    clientSessionIdRef.current = null;
    sessionPromiseRef.current = null;
    pendingGenerationRef.current = null;
    return ensureSession();
  }

  function resetPendingGeneration() {
    pendingGenerationRef.current = null;
  }

  async function trackSessionEvent(
    event:
      | { type: "RATING_SELECTED"; rating: number }
      | { type: "TOPIC_SELECTED"; topicId: string; selected: boolean }
      | { type: "GENERATE_CLICKED" },
  ) {
    try {
      const activeSessionId = await ensureSession();
      await recordSessionEvent(activeSessionId, event);
    } catch {
      // Analytics must never block the customer flow.
    }
  }

  function selectRating(value: Rating) {
    setRating(value);
    resetPendingGeneration();
    void trackSessionEvent({ type: "RATING_SELECTED", rating: value });
  }

  function toggleTopic(id: string) {
    const isSelected = selected.includes(id);
    if (!isSelected && selected.length >= 4) return;

    setSelected((current) => isSelected
      ? current.filter((item) => item !== id)
      : [...current, id]);
    resetPendingGeneration();
    void trackSessionEvent({ type: "TOPIC_SELECTED", topicId: id, selected: !isSelected });
  }

  function updateNote(value: string) {
    setNote(value);
    resetPendingGeneration();
  }

  function getPendingGeneration(nextVariation: number) {
    let pending = pendingGenerationRef.current;
    if (!pending || pending.variation !== nextVariation) {
      pending = { variation: nextVariation, requestId: crypto.randomUUID() };
      pendingGenerationRef.current = pending;
    }
    return pending;
  }

  async function requestDraft(activeSessionId: string, nextVariation: number, requestId: string) {
    return generateReviewDraft({
      sessionId: activeSessionId,
      requestId,
      rating: rating as Rating,
      topicIds: selected,
      note: note.trim() || undefined,
      variation: nextVariation,
    });
  }

  async function createDraft(nextVariation: number) {
    if (!rating || isGenerating) return;

    setError("");
    setIsGenerating(true);

    try {
      let activeSessionId = await ensureSession();
      void recordSessionEvent(activeSessionId, { type: "GENERATE_CLICKED" }).catch(() => undefined);

      let pending = getPendingGeneration(nextVariation);
      let generated;

      try {
        generated = await requestDraft(activeSessionId, nextVariation, pending.requestId);
      } catch (cause) {
        const sessionExpired = cause instanceof ReviewApiError &&
          (cause.code === "SESSION_EXPIRED" || cause.code === "SESSION_NOT_FOUND");
        if (!sessionExpired) throw cause;

        // One bounded recovery attempt: create a fresh scan session, replay current funnel state, then generate once.
        activeSessionId = await renewSession();
        pending = { variation: nextVariation, requestId: crypto.randomUUID() };
        pendingGenerationRef.current = pending;

        void recordSessionEvent(activeSessionId, { type: "RATING_SELECTED", rating }).catch(() => undefined);
        for (const topicId of selected) {
          void recordSessionEvent(activeSessionId, { type: "TOPIC_SELECTED", topicId, selected: true }).catch(() => undefined);
        }
        void recordSessionEvent(activeSessionId, { type: "GENERATE_CLICKED" }).catch(() => undefined);

        generated = await requestDraft(activeSessionId, nextVariation, pending.requestId);
      }

      pendingGenerationRef.current = null;
      setReview(generated.text);
      setDraftId(generated.draftId);
      setVariation(nextVariation);
      setCopied(false);
      setScreen("review");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not generate the review. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }

  function editGeneratedReview(value: string) {
    setReview(value);
    setCopied(false);

    if (draftId && !editedDraftsRef.current.has(draftId)) {
      editedDraftsRef.current.add(draftId);
      void recordReviewEvent(draftId, "REVIEW_EDITED").catch(() => undefined);
    }
  }

  async function handleCopy() {
    setError("");
    const didCopy = await copyText(review);
    setCopied(didCopy);

    if (!didCopy) {
      setError("Automatic copy was blocked by the browser. Select the review text and copy it manually.");
      return;
    }

    if (draftId) void recordReviewEvent(draftId, "REVIEW_COPIED").catch(() => undefined);
  }

  async function handleGoogle() {
    if (!location?.googleReviewUrl) {
      setError("The Google review link is not available for this QR code. Please rescan or contact the business.");
      return;
    }

    const didCopy = await copyText(review);
    setCopied(didCopy);

    if (draftId) {
      if (didCopy) void recordReviewEvent(draftId, "REVIEW_COPIED").catch(() => undefined);
      recordReviewEventOnExit(draftId, "GOOGLE_REVIEW_OPENED");
    }

    window.location.assign(location.googleReviewUrl);
  }

  function reset() {
    // Reset the UI within the same physical scan session so analytics do not count a fake second QR scan.
    pendingGenerationRef.current = null;
    editedDraftsRef.current.clear();
    setDraftId(null);
    setRating(0);
    setSelected([]);
    setNote("");
    setReview("");
    setVariation(0);
    setCopied(false);
    setError("");
    setScreen("compose");
  }

  return (
    <main className="productShell">
      <section className="experienceStage" aria-label="Customer review demo">
        <div className="ambient ambientOne" />
        <div className="ambient ambientTwo" />

        <div className="phoneCard">
          <header className="merchantHeader">
            <div className="merchantBrand">
              <div className="brandMark" aria-hidden="true">{businessInitials(location?.name)}</div>
              <div>
                <span className="eyebrow">QUICK REVIEW</span>
                <h1>{location?.name || "Loading business…"}</h1>
                <p>{location?.subtitle || "Preparing your review experience."}</p>
              </div>
            </div>
            <span className="secureBadge">Secure</span>
          </header>

          <div className="progressWrap" aria-label="Review progress">
            <div className="progressMeta">
              <span>{screen === "compose" ? "Your experience" : "Ready to post"}</span>
              <span>{progress}%</span>
            </div>
            <div className="progressTrack"><span style={{ width: `${progress}%` }} /></div>
          </div>

          {screen === "compose" ? (
            <div className="contentPane">
              <section className="heroQuestion">
                <span className="eyebrow">STEP 01</span>
                <h2>How was your experience?</h2>
                <p>One tap is enough to get started.</p>

                <div className="ratingGrid" role="radiogroup" aria-label="Select rating">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`ratingButton ${rating >= value ? "active" : ""}`}
                      onClick={() => selectRating(value as Rating)}
                      aria-label={`${value} star${value > 1 ? "s" : ""}`}
                      aria-pressed={rating === value}
                    >
                      <span>★</span>
                    </button>
                  ))}
                </div>
                <div className="ratingFeedback">
                  <strong>{rating ? ratingLabels[rating] : "Choose 1–5 stars"}</strong>
                  <span>{contextLabel}</span>
                </div>
              </section>

              <section className="sectionBlock">
                <div className="sectionHeading">
                  <div>
                    <span className="eyebrow">STEP 02</span>
                    <h3>What stood out?</h3>
                    <p>Pick up to 4 neutral topics. Your rating and words control the sentiment.</p>
                  </div>
                  <span className="counter">{selectedCount}/4</span>
                </div>

                <div className="chipGrid">
                  {(location?.topics ?? []).map((topic) => {
                    const isActive = selected.includes(topic.id);
                    return (
                      <button
                        key={topic.id}
                        type="button"
                        className={`topicChip ${isActive ? "active" : ""}`}
                        onClick={() => toggleTopic(topic.id)}
                        aria-pressed={isActive}
                      >
                        <span className="chipIcon">{topic.icon}</span>
                        <span>{topic.label}</span>
                        <span className="chipCheck">{isActive ? "✓" : "+"}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="sectionBlock noteSection">
                <div className="sectionHeading compact">
                  <div>
                    <span className="eyebrow">OPTIONAL</span>
                    <h3>Add your own words</h3>
                    <p>Your note is preserved so the draft never invents a specific experience.</p>
                  </div>
                  <button
                    type="button"
                    className="textAction"
                    onClick={() => updateNote(polishText(note))}
                    disabled={!note.trim()}
                  >
                    ✦ Enhance
                  </button>
                </div>

                <div className="noteBox">
                  <textarea
                    value={note}
                    onChange={(event) => updateNote(event.target.value)}
                    maxLength={180}
                    placeholder="e.g. communication was clear but the process took a little longer"
                  />
                  <div className="noteMeta">
                    <span>No voice input · no account creation</span>
                    <span>{note.length}/180</span>
                  </div>
                </div>
              </section>

              {error ? <p className="microCopy" role="alert">{error}</p> : null}

              <button
                type="button"
                className="primaryAction"
                disabled={!rating || isGenerating || !location}
                onClick={() => void createDraft(variation)}
              >
                <span className="actionIcon">✦</span>
                <span>{isGenerating ? "Generating…" : "Generate my review"}</span>
                <span className="actionArrow">→</span>
              </button>

              <p className="microCopy">Retry-safe backend generation. No external AI key is required for this partner demo.</p>
            </div>
          ) : (
            <div className="contentPane reviewPane">
              <button type="button" className="backLink" onClick={() => setScreen("compose")}>← Edit selections</button>

              <div className="successGlyph">✓</div>
              <span className="eyebrow">STEP 03</span>
              <h2>Your review is ready.</h2>
              <p className="reviewLead">Keep it, edit it, or generate another version. You stay in control.</p>

              <div className="reviewEditor">
                <textarea
                  value={review}
                  onChange={(event) => editGeneratedReview(event.target.value)}
                  aria-label="Generated review"
                />
                <div className="editorToolbar">
                  <button type="button" disabled={isGenerating} onClick={() => void createDraft(variation + 1)}>
                    {isGenerating ? "Generating…" : "↻ Try another"}
                  </button>
                  <button type="button" onClick={() => void handleCopy()}>{copied ? "✓ Copied" : "⧉ Copy"}</button>
                </div>
              </div>

              {error ? <p className="microCopy" role="alert">{error}</p> : null}

              <button type="button" className="primaryAction googleAction" onClick={() => void handleGoogle()} disabled={!review.trim() || !location?.googleReviewUrl}>
                <span className="googleG">G</span>
                <span>{copied ? "Copied — open Google review" : "Copy & open Google review"}</span>
                <span className="actionArrow">↗</span>
              </button>

              <div className="pasteTip">
                <span className="tipIcon">⌘</span>
                <div>
                  <strong>One final action on Google</strong>
                  <p>Your review is copied when the browser allows it. Paste it into Google’s review box, then tap Post.</p>
                </div>
              </div>

              <button type="button" className="restartLink" onClick={reset}>Restart demo</button>
            </div>
          )}
        </div>
      </section>

      <aside className="partnerPanel">
        <div className="panelTopline">
          <span className="statusDot" />
          PARTNER DEMO · HARDENED FULL-STACK FLOW
        </div>

        <div className="partnerHero">
          <span className="panelEyebrow">QR REVIEW SYSTEM</span>
          <h2>From a real-world scan to a Google review with trustworthy analytics.</h2>
          <p>QR-aware sessions, retry-safe generation, merchant management and neutral review drafting now share one production-oriented foundation.</p>
        </div>

        <div className="flowList">
          {[
            ["01", "Scan", "A QR token starts one idempotent, expiring customer session."],
            ["02", "Tap", "Rating and neutral topics create measurable funnel events."],
            ["03", "Generate", "A request key prevents duplicate generation on retries."],
            ["04", "Post", "Copy/open events survive the Google navigation handoff."],
          ].map(([number, title, text]) => (
            <div className="flowItem" key={number}>
              <span>{number}</span>
              <div>
                <strong>{title}</strong>
                <p>{text}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="metricGrid">
          <div><strong>QR</strong><span>Token-aware</span></div>
          <div><strong>TTL</strong><span>Expiring sessions</span></div>
          <div><strong>1×</strong><span>Retry-safe draft</span></div>
          <div><strong>PG</strong><span>Production persistence</span></div>
        </div>

        <div className="panelFootnote">
          <span>Customer flow remains intentionally frictionless.</span>
          <span>Merchant auth, QR management and analytics are active.</span>
        </div>
      </aside>
    </main>
  );
}
