"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { polishText, type Rating } from "@/lib/review";
import {
  generateReviewDraft,
  recordReviewEvent,
  recordReviewEventOnExit,
  recordSessionEvent,
  startReviewSession,
  type LocationDto,
} from "@/lib/review-api";

const FALLBACK_REVIEW_URL = "https://search.google.com/local/writereview?placeid=ChIJIxP2kbaJgzkR6h4dYXKWCcI";
const ratingLabels = ["", "Very poor", "Could be better", "Okay", "Good", "Excellent"];

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

  try {
    const area = document.createElement("textarea");
    area.value = value;
    area.style.position = "fixed";
    area.style.opacity = "0";
    area.style.pointerEvents = "none";
    document.body.appendChild(area);
    area.focus();
    area.select();
    const copied = document.execCommand("copy");
    area.remove();
    return copied;
  } catch {
    return false;
  }
}

export default function ReviewExperience({ qrToken = "mangal-counter-demo" }: ReviewExperienceProps) {
  const [location, setLocation] = useState<LocationDto | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
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
    void ensureSession().catch((cause) => {
      setError(cause instanceof Error ? cause.message : "Could not start the review session.");
    });
    // qrToken is the identity of this public scan page. A route change remounts the experience.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrToken]);

  function getClientSessionId() {
    if (!clientSessionIdRef.current) clientSessionIdRef.current = crypto.randomUUID();
    return clientSessionIdRef.current;
  }

  async function ensureSession() {
    if (sessionId) return sessionId;
    if (sessionPromiseRef.current) return sessionPromiseRef.current;

    const promise = startReviewSession(qrToken, getClientSessionId())
      .then((created) => {
        setSessionId(created.sessionId);
        setLocation(created.location);
        return created.sessionId;
      })
      .finally(() => {
        sessionPromiseRef.current = null;
      });

    sessionPromiseRef.current = promise;
    return promise;
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

  async function createDraft(nextVariation: number) {
    if (!rating || isGenerating) return;

    setError("");
    setIsGenerating(true);

    try {
      const activeSessionId = await ensureSession();
      void recordSessionEvent(activeSessionId, { type: "GENERATE_CLICKED" }).catch(() => undefined);

      let pending = pendingGenerationRef.current;
      if (!pending || pending.variation !== nextVariation) {
        pending = { variation: nextVariation, requestId: crypto.randomUUID() };
        pendingGenerationRef.current = pending;
      }

      const generated = await generateReviewDraft({
        sessionId: activeSessionId,
        requestId: pending.requestId,
        rating,
        topicIds: selected,
        note: note.trim() || undefined,
        variation: nextVariation,
      });

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
    const didCopy = await copyText(review);
    setCopied(didCopy);

    if (!didCopy) {
      setError("Automatic copy was blocked by the browser. Select the review text and copy it manually.");
      return;
    }

    if (draftId) void recordReviewEvent(draftId, "REVIEW_COPIED").catch(() => undefined);
  }

  async function handleGoogle() {
    const didCopy = await copyText(review);
    setCopied(didCopy);

    if (draftId) {
      if (didCopy) void recordReviewEvent(draftId, "REVIEW_COPIED").catch(() => undefined);
      recordReviewEventOnExit(draftId, "GOOGLE_REVIEW_OPENED");
    }

    window.location.assign(location?.googleReviewUrl || FALLBACK_REVIEW_URL);
  }

  function reset() {
    clientSessionIdRef.current = null;
    sessionPromiseRef.current = null;
    pendingGenerationRef.current = null;
    editedDraftsRef.current.clear();
    setSessionId(null);
    setDraftId(null);
    setRating(0);
    setSelected([]);
    setNote("");
    setReview("");
    setVariation(0);
    setCopied(false);
    setError("");
    setScreen("compose");
    void ensureSession().catch(() => undefined);
  }

  return (
    <main className="productShell">
      <section className="experienceStage" aria-label="Customer review demo">
        <div className="ambient ambientOne" />
        <div className="ambient ambientTwo" />

        <div className="phoneCard">
          <header className="merchantHeader">
            <div className="merchantBrand">
              <div className="brandMark" aria-hidden="true">MT</div>
              <div>
                <span className="eyebrow">QUICK REVIEW</span>
                <h1>{location?.name || "Mangal Traders"}</h1>
                <p>{location?.subtitle || "Fast feedback. No login required."}</p>
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
                    placeholder="e.g. staff was helpful but billing took a little time"
                  />
                  <div className="noteMeta">
                    <span>No voice input · no account creation</span>
                    <span>{note.length}/180</span>
                  </div>
                </div>
              </section>

              {error ? <p className="microCopy" role="alert">{error}</p> : null}

              <button
                className="primaryAction"
                disabled={!rating || isGenerating}
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
              <button className="backLink" onClick={() => setScreen("compose")}>← Edit selections</button>

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
                  <button disabled={isGenerating} onClick={() => void createDraft(variation + 1)}>
                    {isGenerating ? "Generating…" : "↻ Try another"}
                  </button>
                  <button onClick={() => void handleCopy()}>{copied ? "✓ Copied" : "⧉ Copy"}</button>
                </div>
              </div>

              {error ? <p className="microCopy" role="alert">{error}</p> : null}

              <button className="primaryAction googleAction" onClick={() => void handleGoogle()} disabled={!review.trim()}>
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

              <button className="restartLink" onClick={reset}>Restart demo</button>
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
          <p>QR-aware sessions, retry-safe generation and neutral review drafting are built into the foundation before merchant dashboards are added.</p>
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
          <span>Next after hardening: merchant auth + management.</span>
        </div>
      </aside>
    </main>
  );
}
