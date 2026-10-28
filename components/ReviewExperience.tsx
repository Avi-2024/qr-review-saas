"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import UiIcon from "@/components/UiIcon";
import type { Rating } from "@/lib/review";
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

const RATING_SENTIMENTS: Record<number, { text: string; icon: string }> = {
  1: { text: "Disappointing", icon: "😞" },
  2: { text: "Could be better", icon: "😐" },
  3: { text: "Average / Okay", icon: "🙂" },
  4: { text: "Great experience!", icon: "😊" },
  5: { text: "Outstanding! Loved it", icon: "🌟" },
};

function businessInitials(name?: string) {
  return (
    name
      ?.trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase())
      .join("") || "QR"
  );
}

function GoogleColorIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
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

async function copyText(value: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* Fallback for restrictive mobile webviews */
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

type PendingGeneration = { rating: Rating; variation: number; requestId: string };
type Props = { qrToken?: string };

export default function ReviewExperience({ qrToken = "mangal-counter-demo" }: Props) {
  const [location, setLocation] = useState<LocationDto | null>(null);
  const [rating, setRating] = useState<Rating | 0>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [variation, setVariation] = useState<number>(0);
  const [screen, setScreen] = useState<"compose" | "review" | "feedback">("compose");
  const [review, setReview] = useState("");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isOpeningGoogle, setIsOpeningGoogle] = useState(false);
  const [copied, setCopied] = useState(false);
  const [handoffMessage, setHandoffMessage] = useState("");
  const [error, setError] = useState("");
  const [copyFailed, setCopyFailed] = useState(false);

  const tokenRef = useRef(qrToken);
  const sessionVersionRef = useRef(0);
  const intentRef = useRef(0);
  const generationLockRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const clientSessionIdRef = useRef<string | null>(null);
  const sessionPromiseRef = useRef<Promise<string> | null>(null);
  const pendingRef = useRef<PendingGeneration | null>(null);
  const editedDraftsRef = useRef(new Set<string>());
  const composeHeadingRef = useRef<HTMLHeadingElement>(null);
  const reviewHeadingRef = useRef<HTMLHeadingElement>(null);
  const feedbackHeadingRef = useRef<HTMLHeadingElement>(null);
  const copyTimeoutRef = useRef<number | null>(null);

  function triggerHaptic() {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(10);
      } catch {
        /* Ignore haptic failure */
      }
    }
  }

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) window.clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (tokenRef.current !== qrToken) {
      tokenRef.current = qrToken;
      sessionVersionRef.current += 1;
      intentRef.current += 1;
      sessionIdRef.current = null;
      clientSessionIdRef.current = null;
      sessionPromiseRef.current = null;
      pendingRef.current = null;
      generationLockRef.current = false;
      editedDraftsRef.current.clear();
      setLocation(null);
      setRating(0);
      setVariation(0);
      setScreen("compose");
      setReview("");
      setDraftId(null);
      setCopied(false);
      setError("");
      setCopyFailed(false);
      setIsGenerating(false);
      setIsOpeningGoogle(false);
      setHandoffMessage("");
    }
    const version = sessionVersionRef.current;
    void ensureSession().catch((cause) => {
      if (version === sessionVersionRef.current) {
        setError(cause instanceof Error ? cause.message : "Could not start the review session.");
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrToken]);

  useEffect(() => {
    const onPageShow = () => {
      setIsOpeningGoogle(false);
      setHandoffMessage("");
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  useEffect(() => {
    if (screen === "review") {
      reviewHeadingRef.current?.focus();
    } else if (screen === "feedback") {
      feedbackHeadingRef.current?.focus();
    } else {
      composeHeadingRef.current?.focus();
    }
  }, [screen]);

  function clientSessionId() {
    if (!clientSessionIdRef.current) clientSessionIdRef.current = crypto.randomUUID();
    return clientSessionIdRef.current;
  }

  async function ensureSession() {
    if (sessionIdRef.current) return sessionIdRef.current;
    if (sessionPromiseRef.current) return sessionPromiseRef.current;
    const currentToken = tokenRef.current;
    const currentVersion = sessionVersionRef.current;
    const promise = startReviewSession(currentToken, clientSessionId())
      .then((created) => {
        if (currentToken !== tokenRef.current || currentVersion !== sessionVersionRef.current) {
          throw new Error("Review session changed. Please try again.");
        }
        sessionIdRef.current = created.sessionId;
        setLocation(created.location);
        return created.sessionId;
      })
      .finally(() => {
        if (sessionPromiseRef.current === promise) sessionPromiseRef.current = null;
      });
    sessionPromiseRef.current = promise;
    return promise;
  }

  async function renewSession() {
    sessionVersionRef.current += 1;
    sessionIdRef.current = null;
    clientSessionIdRef.current = null;
    sessionPromiseRef.current = null;
    return ensureSession();
  }

  async function trackRating(activeSessionId: string, selectedRating: Rating) {
    try {
      await recordSessionEvent(activeSessionId, { type: "RATING_SELECTED", rating: selectedRating });
      await recordSessionEvent(activeSessionId, { type: "GENERATE_CLICKED" });
    } catch {
      /* Analytics failure must not block UX */
    }
  }

  async function createDraft(selectedRating: Rating, targetVariation = 0) {
    if (generationLockRef.current) return;
    generationLockRef.current = true;
    setRating(selectedRating);
    setVariation(targetVariation);
    setError("");
    setCopyFailed(false);
    setIsGenerating(true);
    const intent = ++intentRef.current;
    const currentToken = tokenRef.current;

    if (!pendingRef.current || pendingRef.current.rating !== selectedRating || pendingRef.current.variation !== targetVariation) {
      pendingRef.current = { rating: selectedRating, variation: targetVariation, requestId: crypto.randomUUID() };
    }
    let pending = pendingRef.current;

    try {
      let sessionId = await ensureSession();
      void trackRating(sessionId, selectedRating);
      let generated;
      try {
        generated = await generateReviewDraft({
          sessionId,
          requestId: pending.requestId,
          rating: selectedRating,
          topicIds: [],
          variation: targetVariation,
        });
      } catch (cause) {
        const expired =
          cause instanceof ReviewApiError &&
          (cause.code === "SESSION_EXPIRED" || cause.code === "SESSION_NOT_FOUND");
        if (!expired) throw cause;
        sessionId = await renewSession();
        pending = { rating: selectedRating, variation: targetVariation, requestId: crypto.randomUUID() };
        pendingRef.current = pending;
        void trackRating(sessionId, selectedRating);
        generated = await generateReviewDraft({
          sessionId,
          requestId: pending.requestId,
          rating: selectedRating,
          topicIds: [],
          variation: targetVariation,
        });
      }

      if (intent !== intentRef.current || currentToken !== tokenRef.current) return;
      setReview(generated.text);
      setDraftId(generated.draftId);
      editedDraftsRef.current.clear();
      setCopied(false);
      setHandoffMessage("");
      pendingRef.current = null;
      setScreen("review");
    } catch (cause) {
      if (intent === intentRef.current && currentToken === tokenRef.current) {
        setError(cause instanceof Error ? cause.message : "Could not prepare your review. Please retry.");
      }
    } finally {
      if (intent === intentRef.current) {
        generationLockRef.current = false;
        setIsGenerating(false);
      }
    }
  }

  function selectRating(value: Rating) {
    if (!location || generationLockRef.current) return;
    triggerHaptic();
    setRating(value);
    setError("");

    // 1 and 2 stars: Show instant Thank You screen (strictly no Google redirect)
    if (value <= 2) {
      void ensureSession()
        .then((sessionId) => {
          void recordSessionEvent(sessionId, { type: "RATING_SELECTED", rating: value });
        })
        .catch(() => undefined);

      setScreen("feedback");
      return;
    }

    // 3, 4, 5 stars: Continue to AI draft & Google Review flow
    const initialSeed = Math.floor(Math.random() * 20);
    setVariation(initialSeed);
    void createDraft(value, initialSeed);
  }

  function changeRating() {
    triggerHaptic();
    intentRef.current += 1;
    pendingRef.current = null;
    if (copyTimeoutRef.current) window.clearTimeout(copyTimeoutRef.current);
    setRating(0);
    setHoveredRating(0);
    setVariation(0);
    setReview("");
    setDraftId(null);
    setCopied(false);
    setCopyFailed(false);
    setHandoffMessage("");
    setError("");
    setScreen("compose");
  }

  function editReview(text: string) {
    setReview(text);
    setCopied(false);
    setCopyFailed(false);
    setHandoffMessage("");
    if (draftId && !editedDraftsRef.current.has(draftId)) {
      editedDraftsRef.current.add(draftId);
      void recordReviewEvent(draftId, "REVIEW_EDITED").catch(() => undefined);
    }
  }

  async function handleCopy() {
    if (!review.trim()) return;
    triggerHaptic();
    setError("");
    const success = await copyText(review);
    setCopied(success);
    setCopyFailed(!success);
    if (!success) {
      setError("Copy was blocked. Select the review text and copy it manually.");
      return;
    }
    setHandoffMessage("Review copied ✓");
    if (draftId) void recordReviewEvent(draftId, "REVIEW_COPIED").catch(() => undefined);

    if (copyTimeoutRef.current) window.clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = window.setTimeout(() => {
      setCopied(false);
      setHandoffMessage("");
    }, 2500);
  }

  async function handleGoogle() {
    if (!review.trim() || !location?.googleReviewUrl || isOpeningGoogle) return;
    triggerHaptic();
    setError("");
    const success = await copyText(review);
    setCopied(success);
    setCopyFailed(!success);
    if (!success) {
      setError("Copy was blocked. Copy the text manually, then open Google using the link below.");
      return;
    }

    setIsOpeningGoogle(true);
    setHandoffMessage("Review copied ✓ Opening Google…");
    if (draftId) {
      void recordReviewEvent(draftId, "REVIEW_COPIED").catch(() => undefined);
      recordReviewEventOnExit(draftId, "GOOGLE_REVIEW_OPENED");
    }
    window.setTimeout(() => window.location.assign(location.googleReviewUrl), 200);
  }

  const isDemo = qrToken === "mangal-counter-demo";
  const activeRatingValue = hoveredRating || rating;
  const sentiment = activeRatingValue ? RATING_SENTIMENTS[activeRatingValue] : null;

  return (
    <main className="productShell customerFlowV2 minimalCustomerFlow">
      {/* SaaS Desktop Header (Hidden on Mobile) */}
      <header className="experienceNav">
        <span className="productWordmark">
          <span className="productLogo">
            <UiIcon name="qr" />
          </span>{" "}
          QR Review<span className="wordmarkDot">.</span>
        </span>
        <div className="experienceNavRight">
          {isDemo ? (
            <>
              <span className="demoBadge">Interactive demo</span>
              <Link href="/login">
                Business workspace <UiIcon name="external" />
              </Link>
            </>
          ) : (
            <span className="reviewNavLabel">THE CUSTOMER EXPERIENCE</span>
          )}
        </div>
      </header>

      {/* Main Experience Viewport Stage */}
      <section className="experienceStage" aria-label="Customer review">
        <div className="phoneCard">
          {/* Merchant Brand Identity Header */}
          <header className="merchantHeader customerHeader">
            <div className="merchantBrand">
              <div className="brandMark" aria-hidden="true">
                {businessInitials(location?.name)}
              </div>
              <div className="merchantTitles">
                <h1>{location?.name || (error ? "Review unavailable" : "Getting ready…")}</h1>
                <p className="merchantSubtitle">
                  <span className="verifiedDot">●</span> Google Verified Business
                </p>
              </div>
            </div>
            <div className="headerGoogleBadge" title="Official Google Reviews">
              <GoogleColorIcon />
            </div>
          </header>

          {screen === "compose" ? (
            <div className="contentPane composePane minimalComposePane">
              <section className="heroQuestion customerQuestion">
                <h2 ref={composeHeadingRef} tabIndex={-1}>
                  How was your experience?
                </h2>
                <p className="heroSubtitle">{location?.subtitle || "Tap a star to rate your visit"}</p>

                <div
                  className="ratingGrid"
                  role="group"
                  aria-label="Select rating"
                  onMouseLeave={() => setHoveredRating(0)}
                >
                  {([1, 2, 3, 4, 5] as Rating[]).map((value) => {
                    const isLit = value <= (hoveredRating || rating);
                    return (
                      <button
                        key={value}
                        type="button"
                        className={`ratingButton ${isLit ? "active" : ""}`}
                        onClick={() => selectRating(value)}
                        onMouseEnter={() => setHoveredRating(value)}
                        aria-label={`${value} star${value === 1 ? "" : "s"}`}
                        aria-pressed={value <= rating}
                        disabled={!location || isGenerating}
                      >
                        <UiIcon name="star" />
                        <small>{value}</small>
                      </button>
                    );
                  })}
                </div>

                <div className="ratingFeedback" aria-live="polite">
                  {sentiment ? (
                    <span className="sentimentContent">
                      <span className="sentimentEmoji">{sentiment.icon}</span>
                      <strong>{sentiment.text}</strong>
                    </span>
                  ) : (
                    <span className="sentimentContent neutral">
                      <span className="sentimentEmoji">⭐</span>
                      <span>{isGenerating ? "Preparing your review…" : "Choose 1 to 5 stars"}</span>
                    </span>
                  )}
                </div>
              </section>

              {isGenerating ? (
                <div className="minimalLoading" role="status">
                  <UiIcon name="sparkle" /> Crafting your review draft…
                </div>
              ) : null}

              {error ? (
                <p className="customerError" role="alert">
                  {error}
                </p>
              ) : null}

              {error && !location ? (
                <button
                  type="button"
                  className="retryAction"
                  onClick={() => {
                    setError("");
                    void ensureSession().catch((cause) =>
                      setError(cause instanceof Error ? cause.message : "Could not load the review.")
                    );
                  }}
                >
                  Try loading again <UiIcon name="arrow" />
                </button>
              ) : null}

              {error && location && rating && !isGenerating ? (
                <button
                  type="button"
                  className="retryAction"
                  onClick={() => void createDraft(rating, variation)}
                >
                  Retry review <UiIcon name="arrow" />
                </button>
              ) : null}
            </div>
          ) : screen === "feedback" ? (
            <div className="contentPane feedbackPane minimalFeedbackPane">
              <div className="feedbackSuccessCard">
                <div className="feedbackSuccessBadge" aria-hidden="true">
                  <UiIcon name="check" />
                </div>
                <h2 ref={feedbackHeadingRef} tabIndex={-1}>
                  Thank you for your review!
                </h2>
                <p className="feedbackSuccessMessage">
                  We appreciate your feedback and look forward to serving you better next time.
                </p>

                <div className="feedbackRatingPill thankYouRatingPill">
                  <div className="ratingPillLeft">
                    <div className="ratingPillStars" aria-hidden="true">
                      {[1, 2, 3, 4, 5].map((val) => (
                        <span
                          key={val}
                          className={`pillStarIcon ${val <= rating ? "filled" : "empty"}`}
                        >
                          <UiIcon name="star" />
                        </span>
                      ))}
                    </div>
                    <span className="pillSentimentText">
                      {rating === 1 ? "1 Star" : "2 Stars"}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="pillChangeBtn"
                    onClick={changeRating}
                  >
                    Change rating
                  </button>
                </div>

                <button
                  type="button"
                  className="primaryAction doneFeedbackBtn"
                  onClick={changeRating}
                >
                  <span>Done</span>
                  <span className="actionArrow">
                    <UiIcon name="check" />
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <div className="contentPane reviewPane customerReviewPane minimalReviewPane">
              {/* Review Ready & Rating Summary Row */}
              <div className="reviewReadyMetaRow">
                <div className="reviewReadyTitleGroup">
                  <span className="successGlyph">
                    <UiIcon name="check" />
                  </span>
                  <h2 ref={reviewHeadingRef} tabIndex={-1}>
                    Your review is ready
                  </h2>
                </div>

                <div className="ratingStarsCol">
                  <div className="ratingStarsRow" aria-hidden="true">
                    {[1, 2, 3, 4, 5].map((val) => (
                      <span
                        key={val}
                        className={`reviewStarIcon ${val <= rating ? "filled" : "empty"}`}
                      >
                        <UiIcon name="star" />
                      </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="backLink"
                    disabled={isOpeningGoogle}
                    onClick={changeRating}
                  >
                    Change rating
                  </button>
                </div>
              </div>

              {/* Review Editor Box */}
              <div className="reviewEditor">
                <div className="reviewEditorHeading">
                  <span className="draftBadge">
                    <UiIcon name="sparkle" /> AI Draft
                  </span>
                  <span className="tapHint">
                    <UiIcon name="edit" /> Tap to edit
                  </span>
                </div>
                <textarea
                  className={isGenerating ? "textareaDraftLoading" : ""}
                  value={review}
                  onChange={(event) => editReview(event.target.value)}
                  aria-label="Generated review"
                  disabled={isOpeningGoogle}
                  placeholder="Share your thoughts about your visit..."
                />
              </div>

              {/* Handoff / Copy Feedback Toast */}
              {handoffMessage ? (
                <div className="handoffStatus" role="status">
                  <UiIcon name="check" /> {handoffMessage}
                </div>
              ) : null}

              {error ? (
                <p className="customerError" role="alert">
                  {error}
                </p>
              ) : null}

              {/* Primary Google CTA */}
              <button
                type="button"
                className={`primaryAction googleAction ${isOpeningGoogle ? "isOpening" : ""}`}
                onClick={() => void handleGoogle()}
                disabled={!review.trim() || !location?.googleReviewUrl || isOpeningGoogle}
              >
                <span className="googleGWrapper">
                  <GoogleColorIcon />
                </span>
                <span className="googleActionText">
                  {isOpeningGoogle ? (
                    <span className="openingGoogleState">
                      <span className="buttonSpinner" aria-hidden="true" /> Opening Google…
                    </span>
                  ) : (
                    "Copy & open Google review"
                  )}
                </span>
                <span className="actionArrow">
                  <UiIcon name="external" />
                </span>
              </button>

              {/* Secondary Actions (Try Another / Copy Only) */}
              <div className="secondaryReviewActions minimalSecondaryActions">
                <button
                  type="button"
                  className={isGenerating ? "isRegenerating" : ""}
                  disabled={isOpeningGoogle || isGenerating}
                  onClick={() => void createDraft(rating as Rating, (variation + 1) % 20)}
                >
                  <UiIcon name="sparkle" /> {isGenerating ? "Writing…" : "↻ Try another"}
                </button>
                <button
                  type="button"
                  className={copied ? "copySuccessBtn" : ""}
                  disabled={isOpeningGoogle || !review.trim()}
                  onClick={() => void handleCopy()}
                >
                  <UiIcon name={copied ? "check" : "copy"} /> {copied ? "Copied" : "Copy only"}
                </button>
              </div>

              {copyFailed && location?.googleReviewUrl ? (
                <a
                  className="retryAction minimalManualGoogle"
                  href={location.googleReviewUrl}
                  onClick={() => {
                    if (draftId) recordReviewEventOnExit(draftId, "GOOGLE_REVIEW_OPENED");
                  }}
                >
                  Open Google without copying <UiIcon name="external" />
                </a>
              ) : null}
            </div>
          )}

          {/* Integrated Trust Footer */}
          <footer className="customerFooter">
            <span className="customerFooterContent">
              <svg
                className="customerFooterLock"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>
                Powered by <strong>QR Review</strong> • Verified Partner
              </span>
            </span>
          </footer>
        </div>
      </section>

      {/* Desktop Companion Panel (Hidden on Mobile) */}
      <aside className="partnerPanel">
        <div className="partnerHero">
          <span className="panelEyebrow">
            <i /> SHARE YOUR EXPERIENCE
          </span>
          <h2>
            One tap.
            <br />
            <span>Your own words.</span>
          </h2>
          <p>Choose a rating, check the draft, and decide what you&apos;d like to share.</p>
        </div>
        <div className="experienceGuide">
          <div>
            <span>01</span>
            <strong>Choose your rating</strong>
            <p>Every experience matters.</p>
          </div>
          <div>
            <span>02</span>
            <strong>Review &amp; share</strong>
            <p>Edit freely, then open Google.</p>
          </div>
        </div>
        <div className="panelFootnote">
          <span>
            <UiIcon name="check" /> Every rating welcome
          </span>
          <span>
            <UiIcon name="edit" /> You control the final words
          </span>
        </div>
      </aside>

      {/* Desktop Page Footer (Hidden on Mobile) */}
      <footer className="experiencePageFooter">
        <span>QR Review / Thoughtful feedback, made simple.</span>
        <span>YOUR EXPERIENCE. YOUR WORDS.</span>
      </footer>
    </main>
  );
}
