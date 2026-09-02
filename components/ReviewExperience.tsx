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

const MAX_TOPICS = 3;
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
  const [noteOpen, setNoteOpen] = useState(false);
  const [review, setReview] = useState("");
  const [variation, setVariation] = useState(0);
  const [screen, setScreen] = useState<"compose" | "review">("compose");
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isOpeningGoogle, setIsOpeningGoogle] = useState(false);
  const [handoffMessage, setHandoffMessage] = useState("");
  const [error, setError] = useState("");

  const qrTokenRef = useRef(qrToken);
  const sessionGenerationRef = useRef(0);
  const sessionIdRef = useRef<string | null>(null);
  const clientSessionIdRef = useRef<string | null>(null);
  const sessionPromiseRef = useRef<Promise<string> | null>(null);
  const pendingGenerationRef = useRef<PendingGeneration | null>(null);
  const editedDraftsRef = useRef(new Set<string>());

  const selectedCount = selected.length;
  const isDemo = qrToken === "mangal-counter-demo";
  const contextLabel = useMemo(() => {
    if (!rating) return "Tap a star to begin";
    if (!selectedCount) return "Add a few details if you want";
    return `${selectedCount} of ${MAX_TOPICS} details selected`;
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
      setNoteOpen(false);
      setReview("");
      setVariation(0);
      setScreen("compose");
      setCopied(false);
      setIsOpeningGoogle(false);
      setHandoffMessage("");
      setError("");
    }

    void ensureSession().catch((cause) => {
      setError(cause instanceof Error ? cause.message : "Could not start the review session.");
    });
    // ensureSession uses refs as its source of truth, which avoids stale React state and Strict Mode duplicate sessions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrToken]);

  useEffect(() => {
    const handlePageShow = () => {
      setIsOpeningGoogle(false);
      setHandoffMessage("");
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

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
        if (sessionPromiseRef.current === promise) sessionPromiseRef.current = null;
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
    if (!isSelected && selected.length >= MAX_TOPICS) return;

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
      setHandoffMessage("");
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
    setHandoffMessage("");

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
      setError("Automatic copy was blocked. Select the review text and copy it manually.");
      return;
    }

    setHandoffMessage("Review copied ✓");
    if (draftId) void recordReviewEvent(draftId, "REVIEW_COPIED").catch(() => undefined);
  }

  async function handleGoogle() {
    if (!location?.googleReviewUrl || isOpeningGoogle) {
      if (!location?.googleReviewUrl) {
        setError("The Google review link is not available for this QR code. Please contact the business.");
      }
      return;
    }

    setError("");
    setIsOpeningGoogle(true);
    const didCopy = await copyText(review);
    setCopied(didCopy);
    setHandoffMessage(didCopy ? "Review copied ✓ Opening Google…" : "Opening Google…");

    if (draftId) {
      if (didCopy) void recordReviewEvent(draftId, "REVIEW_COPIED").catch(() => undefined);
      recordReviewEventOnExit(draftId, "GOOGLE_REVIEW_OPENED");
    }

    window.setTimeout(() => {
      window.location.assign(location.googleReviewUrl);
    }, didCopy ? 450 : 120);
  }

  function reset() {
    pendingGenerationRef.current = null;
    editedDraftsRef.current.clear();
    setDraftId(null);
    setRating(0);
    setSelected([]);
    setNote("");
    setNoteOpen(false);
    setReview("");
    setVariation(0);
    setCopied(false);
    setIsOpeningGoogle(false);
    setHandoffMessage("");
    setError("");
    setScreen("compose");
  }

  return (
    <main className="productShell customerFlowV2">
      <section className="experienceStage" aria-label="Customer review">
        <div className="ambient ambientOne" />
        <div className="ambient ambientTwo" />

        <div className="phoneCard">
          <header className="merchantHeader customerHeader">
            <div className="merchantBrand">
              <div className="brandMark" aria-hidden="true">{businessInitials(location?.name)}</div>
              <div>
                <h1>{location?.name || "Loading…"}</h1>
                <p>{location?.subtitle || "Share your experience in a few taps."}</p>
              </div>
            </div>
          </header>

          {screen === "compose" ? (
            <div className="contentPane composePane">
              <section className="heroQuestion customerQuestion">
                <h2>How was your experience?</h2>
                <p>Your rating sets the overall tone of your review.</p>

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

              <section className={`sectionBlock topicSection ${rating ? "ready" : ""}`}>
                <div className="sectionHeading">
                  <div>
                    <h3>What stood out?</h3>
                    <p>Choose up to {MAX_TOPICS}. Skip this if your rating says enough.</p>
                  </div>
                  <span className="counter">{selectedCount}/{MAX_TOPICS}</span>
                </div>

                <div className="chipGrid">
                  {(location?.topics ?? []).map((topic) => {
                    const isActive = selected.includes(topic.id);
                    const isUnavailable = !isActive && selectedCount >= MAX_TOPICS;
                    return (
                      <button
                        key={topic.id}
                        type="button"
                        className={`topicChip ${isActive ? "active" : ""}`}
                        onClick={() => toggleTopic(topic.id)}
                        aria-pressed={isActive}
                        disabled={!rating || isUnavailable}
                      >
                        <span className="chipIcon">{topic.icon}</span>
                        <span>{topic.label}</span>
                        <span className="chipCheck">{isActive ? "✓" : "+"}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="optionalNoteSection">
                <button
                  type="button"
                  className="noteDisclosure"
                  onClick={() => setNoteOpen((open) => !open)}
                  aria-expanded={noteOpen}
                >
                  <span>{noteOpen ? "−" : "+"}</span>
                  <strong>{noteOpen ? "Hide comment" : "Add a comment"}</strong>
                  <small>Optional</small>
                </button>

                {noteOpen ? (
                  <div className="noteReveal">
                    <div className="noteBox">
                      <textarea
                        value={note}
                        onChange={(event) => updateNote(event.target.value)}
                        maxLength={180}
                        placeholder="Add any detail you want the review to preserve"
                        autoFocus
                      />
                      <div className="noteMeta">
                        <button
                          type="button"
                          className="inlinePolishAction"
                          onClick={() => updateNote(polishText(note))}
                          disabled={!note.trim()}
                        >
                          ✦ Polish wording
                        </button>
                        <span>{note.length}/180</span>
                      </div>
                    </div>
                  </div>
                ) : null}
              </section>

              {error ? <p className="customerError" role="alert">{error}</p> : null}

              <div className="composeStickyAction">
                <button
                  type="button"
                  className="primaryAction"
                  disabled={!rating || isGenerating || !location}
                  onClick={() => void createDraft(variation)}
                >
                  <span className="actionIcon">✦</span>
                  <span>{isGenerating ? "Writing your review…" : "Generate my review"}</span>
                  <span className="actionArrow">→</span>
                </button>
                <p>Editable before you open Google</p>
              </div>
            </div>
          ) : (
            <div className="contentPane reviewPane customerReviewPane">
              <button type="button" className="backLink" onClick={() => setScreen("compose")}>← Edit rating & details</button>

              <div className="reviewReadyHeader">
                <div className="successGlyph">✓</div>
                <div>
                  <h2>Your review is ready</h2>
                  <p className="reviewLead">Read it once, edit anything you want, then continue to Google.</p>
                </div>
              </div>

              <div className="reviewEditor">
                <textarea
                  value={review}
                  onChange={(event) => editGeneratedReview(event.target.value)}
                  aria-label="Generated review"
                />
              </div>

              {handoffMessage ? <div className="handoffStatus" role="status">{handoffMessage}</div> : null}
              {error ? <p className="customerError" role="alert">{error}</p> : null}

              <button
                type="button"
                className="primaryAction googleAction"
                onClick={() => void handleGoogle()}
                disabled={!review.trim() || !location?.googleReviewUrl || isOpeningGoogle}
              >
                <span className="googleG">G</span>
                <span>{isOpeningGoogle ? "Opening Google…" : "Copy & open Google review"}</span>
                <span className="actionArrow">↗</span>
              </button>

              <p className="pasteInstruction">Paste the copied review into Google, then tap <strong>Post</strong>.</p>

              <div className="secondaryReviewActions">
                <button type="button" disabled={isGenerating || isOpeningGoogle} onClick={() => void createDraft(variation + 1)}>
                  {isGenerating ? "Writing…" : "↻ Try another"}
                </button>
                <button type="button" disabled={isOpeningGoogle} onClick={() => void handleCopy()}>
                  {copied ? "✓ Copied" : "⧉ Copy only"}
                </button>
              </div>

              {isDemo ? <button type="button" className="restartLink" onClick={reset}>Restart demo</button> : null}
            </div>
          )}
        </div>
      </section>

      <aside className="partnerPanel">
        <div className="panelTopline">
          <span className="statusDot" />
          CUSTOMER FLOW · OPTIMIZED
        </div>

        <div className="partnerHero">
          <span className="panelEyebrow">QR REVIEW SYSTEM</span>
          <h2>Fewer decisions between a scan and an authentic Google review.</h2>
          <p>The customer path now prioritizes one rating, up to three optional details, one optional comment and one primary Google handoff.</p>
        </div>

        <div className="flowList">
          {[
            ["01", "Rate", "One-tap 1–5 star sentiment input."],
            ["02", "Detail", "Up to three neutral topics; completely optional."],
            ["03", "Generate", "The comment stays collapsed unless the customer needs it."],
            ["04", "Google", "One primary action copies the draft and opens the Google composer."],
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
          <div><strong>1</strong><span>Primary CTA</span></div>
          <div><strong>3</strong><span>Max topics</span></div>
          <div><strong>0</strong><span>Required text</span></div>
          <div><strong>1×</strong><span>Google handoff</span></div>
        </div>

        <div className="panelFootnote">
          <span>Customer language is intentionally non-technical.</span>
          <span>Analytics, idempotency and policy-safe routing remain unchanged.</span>
        </div>
      </aside>
    </main>
  );
}
