"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import UiIcon, { type IconName } from "@/components/UiIcon";
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
const defaultTopicIcons: Record<string, IconName> = {
  "★": "star", "🤝": "people", "◎": "value", "✓": "check", "✨": "sparkle", "⚡": "bolt",
};

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
        <div className="customerBrandBar"><span className="productWordmark"><UiIcon name="qr" /> QR Review</span>{isDemo ? <span className="demoBadge">Customer preview</span> : null}</div>
        <div className="phoneCard">
          <header className="merchantHeader customerHeader">
            <div className="merchantBrand">
              <div className="brandMark" aria-hidden="true">{businessInitials(location?.name)}</div>
              <div>
                <span className="businessEyebrow">YOUR EXPERIENCE AT</span>
                <h1>{location?.name || (error ? "Review unavailable" : "Getting ready…")}</h1>
                <p>{location?.subtitle || "Share your experience in a few taps."}</p>
              </div>
            </div>
          </header>

          <div className="customerSteps" aria-label="Review progress">
            <span className={screen === "compose" ? "current" : "complete"} aria-current={screen === "compose" ? "step" : undefined}><i>{screen === "review" ? <UiIcon name="check" /> : "01"}</i>Your experience</span>
            <span className={screen === "review" ? "current" : ""} aria-current={screen === "review" ? "step" : undefined}><i>02</i>Your review</span>
          </div>

          {screen === "compose" ? (
            <div className="contentPane composePane">
              <section className="heroQuestion customerQuestion">
                <span className="sectionEyebrow">LET’S START WITH YOU</span>
                <h2>How was your<br />experience?</h2>
                <p>A few taps. An honest review. All in your words.</p>

                <div className="ratingGrid" role="group" aria-label="Select rating">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`ratingButton ${rating >= value ? "active" : ""}`}
                      onClick={() => selectRating(value as Rating)}
                      aria-label={`${value} star${value > 1 ? "s" : ""}`}
                      aria-pressed={rating === value}
                      disabled={!location || isGenerating}
                    >
                      <UiIcon name="star" /><small>{value}</small>
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
                    <p>Choose up to {MAX_TOPICS} details. Completely optional.</p>
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
                        disabled={!rating || isUnavailable || isGenerating}
                      >
                        <span className="chipIcon" aria-hidden="true">{defaultTopicIcons[topic.icon] ? <UiIcon name={defaultTopicIcons[topic.icon]} /> : topic.icon}</span>
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
                  aria-controls="customer-comment"
                  disabled={isGenerating}
                >
                  <span>{noteOpen ? "−" : "+"}</span>
                  <strong>{noteOpen ? "Hide comment" : "Add a comment"}</strong>
                  <small>Optional</small>
                </button>

                {noteOpen ? (
                  <div className="noteReveal" id="customer-comment">
                    <div className="noteBox">
                      <textarea
                        value={note}
                        onChange={(event) => updateNote(event.target.value)}
                        maxLength={180}
                        placeholder="Add any detail you want the review to preserve"
                        autoFocus
                        aria-label="Your comment"
                        disabled={isGenerating}
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
              {error && !location ? <button type="button" className="retryAction" onClick={() => { setError(""); void ensureSession().catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load the review.")); }}>Try loading again <UiIcon name="arrow" /></button> : null}

              <div className="composeStickyAction">
                <button
                  type="button"
                  className="primaryAction"
                  disabled={!rating || isGenerating || !location}
                  onClick={() => void createDraft(variation)}
                >
                  <span className="actionIcon"><UiIcon name="sparkle" /></span>
                  <span>{isGenerating ? "Writing your review…" : "Generate my review"}</span>
                  <span className="actionArrow"><UiIcon name="arrow" /></span>
                </button>
                <p>You’re always in control of what you share.</p>
              </div>
            </div>
          ) : (
            <div className="contentPane reviewPane customerReviewPane">
              <button type="button" className="backLink" disabled={isGenerating || isOpeningGoogle} onClick={() => setScreen("compose")}><span aria-hidden="true">←</span> Edit rating & details</button>

              <div className="reviewReadyHeader">
                <div className="successGlyph"><UiIcon name="check" /></div>
                <div>
                  <h2>Your review is ready</h2>
                  <p className="reviewLead">Read it once, edit anything you want, then continue to Google.</p>
                </div>
              </div>

              <div className="reviewEditor">
                <div className="reviewEditorHeading"><span><UiIcon name="edit" /> YOUR DRAFT</span><span>{rating} / 5 stars</span></div>
                <textarea
                  value={review}
                  onChange={(event) => editGeneratedReview(event.target.value)}
                  aria-label="Generated review"
                />
                <div className="reviewEditorFoot"><span>Make it sound like you.</span><span>{review.length} characters</span></div>
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
                <span className="actionArrow"><UiIcon name="external" /></span>
              </button>

              <p className="pasteInstruction">Paste the copied review into Google, then tap <strong>Post</strong>.</p>

              <div className="secondaryReviewActions">
                <button type="button" disabled={isGenerating || isOpeningGoogle} onClick={() => void createDraft(variation + 1)}>
                  {isGenerating ? "Writing…" : "↻ Try another"}
                </button>
                <button type="button" disabled={isOpeningGoogle || !review.trim()} onClick={() => void handleCopy()}>
                  <UiIcon name={copied ? "check" : "copy"} /> {copied ? "Copied" : "Copy only"}
                </button>
              </div>

              {isDemo ? <button type="button" className="restartLink" onClick={reset}>Restart demo</button> : null}
            </div>
          )}
        </div>
        <footer className="customerFooter"><span>Thoughtful feedback, made simple.</span><span>Powered by <strong>QR Review</strong></span></footer>
      </section>

      <aside className="partnerPanel">
        <div className="panelTopline"><UiIcon name="qr" /><strong>QR Review</strong><span>THE CUSTOMER EXPERIENCE</span></div>
        <div className="partnerHero">
          <span className="panelEyebrow">EVERY EXPERIENCE HAS A STORY</span>
          <h2>A little feedback.<br /><em>A lasting<br />impression.</em></h2>
          <p>Good, bad, or somewhere in between.<br />Help others with a review that feels like you.</p>
        </div>
        <div className="editorialCard" aria-hidden="true">
          <div className="editorialCardTop"><span>THE HUMAN SIDE OF FEEDBACK</span><UiIcon name="sparkle" /></div>
          <p>Your words.<br />Your experience.</p>
          <div className="editorialCardBottom"><span>Rate. Refine. Share.</span><UiIcon name="arrow" /></div>
        </div>
        <div className="panelFootnote"><span><UiIcon name="check" /> Honest at every rating</span><span><UiIcon name="edit" /> Always yours to edit</span></div>
      </aside>
    </main>
  );
}
