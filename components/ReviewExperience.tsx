"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./ReviewExperience.module.css";
import UiIcon from "@/components/UiIcon";
import type { Rating } from "@/lib/review";
import {
  generateReviewDraft, recordReviewEvent, recordReviewEventOnExit,
  recordSessionEvent, ReviewApiError, startReviewSession, type LocationDto,
} from "@/lib/review-api";

const ratingLabels = ["", "Very poor", "Could be better", "Okay", "Good", "Excellent"];

function businessInitials(name?: string) {
  return name?.trim().split(/\s+/).slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "QR";
}

async function copyText(value: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch { /* Some browsers block the Clipboard API. Try the legacy fallback. */ }

  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  let area: HTMLTextAreaElement | null = null;
  try {
    area = document.createElement("textarea");
    area.value = value;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.focus();
    area.select();
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area?.remove();
    previousFocus?.focus({ preventScroll: true });
  }
}

type PendingGeneration = { rating: Rating; requestId: string };
type Props = { qrToken?: string };

export default function ReviewExperience({ qrToken = "mangal-counter-demo" }: Props) {
  const [location, setLocation] = useState<LocationDto | null>(null);
  const [rating, setRating] = useState<Rating | 0>(0);
  const [screen, setScreen] = useState<"compose" | "review">("compose");
  const [review, setReview] = useState("");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isOpeningGoogle, setIsOpeningGoogle] = useState(false);
  const [copied, setCopied] = useState(false);
  const [handoffMessage, setHandoffMessage] = useState("");
  const [error, setError] = useState("");
  const [copyFailed, setCopyFailed] = useState(false);
  const [hoverRating, setHoverRating] = useState<Rating | 0>(0);
  const [isCopying, setIsCopying] = useState(false);
  const clipboardLockRef = useRef(false);
  const reviewInputRef = useRef<HTMLTextAreaElement>(null);

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
    // Session IDs and in-flight requests are held in refs to dedupe Strict Mode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrToken]);

  useEffect(() => {
    const onPageShow = () => { setIsOpeningGoogle(false); setHandoffMessage(""); };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  useEffect(() => {
    (screen === "review" ? reviewHeadingRef : composeHeadingRef).current?.focus();
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
    } catch { /* Analytics must not prevent review generation. */ }
  }

  async function createDraft(selectedRating: Rating) {
    if (generationLockRef.current) return;
    generationLockRef.current = true;
    setHoverRating(0);
    setRating(selectedRating);
    setError("");
    setCopyFailed(false);
    setIsGenerating(true);
    const intent = ++intentRef.current;
    const currentToken = tokenRef.current;

    if (!pendingRef.current || pendingRef.current.rating !== selectedRating) {
      pendingRef.current = { rating: selectedRating, requestId: crypto.randomUUID() };
    }
    let pending = pendingRef.current;

    try {
      let sessionId = await ensureSession();
      void trackRating(sessionId, selectedRating);
      let generated;
      try {
        generated = await generateReviewDraft({
          sessionId, requestId: pending.requestId,
          rating: selectedRating, topicIds: [], variation: 0,
        });
      } catch (cause) {
        const expired = cause instanceof ReviewApiError &&
          (cause.code === "SESSION_EXPIRED" || cause.code === "SESSION_NOT_FOUND");
        if (!expired) throw cause;
        sessionId = await renewSession();
        pending = { rating: selectedRating, requestId: crypto.randomUUID() };
        pendingRef.current = pending;
        void trackRating(sessionId, selectedRating);
        generated = await generateReviewDraft({
          sessionId, requestId: pending.requestId,
          rating: selectedRating, topicIds: [], variation: 0,
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
    void createDraft(value);
  }

  function changeRating() {
    if (clipboardLockRef.current || isOpeningGoogle) return;
    setHoverRating(0);
    intentRef.current += 1;
    pendingRef.current = null;
    setRating(0);
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

  async function copyReview(openGoogle: boolean) {
    if (!review.trim() || clipboardLockRef.current || isOpeningGoogle) return;
    if (openGoogle && !location?.googleReviewUrl) return;
    clipboardLockRef.current = true;
    setIsCopying(true);
    setError("");
    const intent = intentRef.current;
    try {
      const success = await copyText(review);
      if (intent !== intentRef.current) return;
      setCopied(success);
      setCopyFailed(!success);
      if (!success) {
        setError("Your browser couldn't copy the text. Select it below and copy it manually.");
        return;
      }
      if (draftId) void recordReviewEvent(draftId, "REVIEW_COPIED").catch(() => undefined);
      if (openGoogle && location?.googleReviewUrl) {
        setIsOpeningGoogle(true);
        setHandoffMessage("Review copied. Opening Google…");
        if (draftId) recordReviewEventOnExit(draftId, "GOOGLE_REVIEW_OPENED");
        window.location.assign(location.googleReviewUrl);
      } else {
        setHandoffMessage("Review copied. Ready to paste.");
      }
    } finally {
      clipboardLockRef.current = false;
      setIsCopying(false);
    }
  }

  const busy = isCopying || isOpeningGoogle;
  const previewRating = hoverRating || rating;
  const isReady = screen === "review";

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.topbar}>
          <span className={styles.wordmark}><UiIcon name="qr" /> QR Review<span>.</span></span>
          <span className={styles.topline}>Your experience matters</span>
        </header>

        <section className={styles.card} aria-label="Customer review">
          <header className={styles.business}>
            <div className={styles.avatar} aria-hidden="true">{businessInitials(location?.name)}</div>
            <div className={styles.businessText}>
              <span className={styles.eyebrow}>YOU'RE REVIEWING</span>
              <h1>{location?.name || (error ? "Review unavailable" : "Getting ready…")}</h1>
              {location?.subtitle ? <p>{location.subtitle}</p> : null}
            </div>
            <span className={styles.scanMark} aria-hidden="true"><UiIcon name="qr" /></span>
          </header>

          <ol className={styles.steps} aria-label="Review progress">
            <li className={!isReady ? styles.currentStep : styles.doneStep} aria-current={!isReady ? "step" : undefined}>
              <span>{isReady ? <UiIcon name="check" /> : "1"}</span> Rate your visit
            </li>
            <li className={styles.stepLine} aria-hidden="true" />
            <li className={isReady ? styles.currentStep : undefined} aria-current={isReady ? "step" : undefined}>
              <span>2</span> Review & share
            </li>
          </ol>

          {!isReady ? (
            <div className={styles.compose}>
              <div className={styles.heroGlyph} aria-hidden="true"><UiIcon name="topics" /><span><UiIcon name="star" /></span></div>
              <h2 ref={composeHeadingRef} tabIndex={-1}>How was your experience?</h2>
              <p className={styles.intro}>Tap a star. Get a short review draft.<br />Make it yours before you share.</p>

              <div className={styles.ratingGrid} role="group" aria-label="Select rating" aria-describedby="rating-help" aria-busy={isGenerating}
                onMouseLeave={() => setHoverRating(0)}>
                {([1, 2, 3, 4, 5] as Rating[]).map((value) => (
                  <button key={value} type="button"
                    className={`${styles.ratingButton} ${previewRating >= value ? styles.filledStar : ""} ${rating === value ? styles.selectedStar : ""}`}
                    onClick={() => selectRating(value)}
                    onMouseEnter={() => { if (!isGenerating) setHoverRating(value); }}
                    onFocus={() => { if (!isGenerating) setHoverRating(value); }}
                    onBlur={() => setHoverRating(0)}
                    aria-label={`${value} star${value === 1 ? "" : "s"}`}
                    aria-pressed={rating === value}
                    disabled={!location || isGenerating}>
                    <UiIcon name="star" /><span>{value}</span>
                  </button>
                ))}
              </div>
              <div className={styles.ratingScale} aria-hidden="true"><span>Very poor</span><span>Excellent</span></div>
              <div className={styles.ratingHint} id="rating-help" role="status">
                {isGenerating ? <><span className={styles.spinner} aria-hidden="true" /> Preparing your review…</> :
                  !location ? (error ? "Please try loading the review again." : "Loading business details…") :
                  previewRating ? <><strong>{ratingLabels[previewRating]}</strong><span>·</span>{rating ? "Tap a star to try again" : "Tap to choose"}</> :
                  <>Choose a rating to get started <UiIcon name="arrow" /></>}
              </div>
              {error ? <p className={`customerError ${styles.error}`} role="alert">{error}</p> : null}
              {error && !location ? (
                <button type="button" className={styles.textAction} onClick={() => {
                  setError("");
                  void ensureSession().catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load the review."));
                }}>Try loading again <UiIcon name="arrow" /></button>
              ) : null}
              {error && location && rating && !isGenerating ? (
                <button type="button" className={styles.textAction} onClick={() => void createDraft(rating)}>Retry review <UiIcon name="arrow" /></button>
              ) : null}
              <div className={styles.reassurance}>
                <span className={styles.reassuranceIcon}><UiIcon name="edit" /></span>
                <div><strong>Your experience. Your words.</strong><p>Every rating is welcome. You decide what to post.</p></div>
              </div>
            </div>
          ) : (
            <div className={styles.review}>
              <div className={styles.ratingSummary}>
                <div className={styles.ratingValue}>
                  <span className={styles.miniStars} aria-hidden="true">
                    {([1, 2, 3, 4, 5] as Rating[]).map((value) => <UiIcon key={value} name="star" className={value <= rating ? styles.miniFilled : ""} />)}
                  </span>
                  <span>{rating} / 5</span>
                </div>
                <button type="button" className={styles.changeRating} disabled={busy} onClick={changeRating}>Change rating</button>
              </div>
              <h2 ref={reviewHeadingRef} tabIndex={-1}>Your review is ready</h2>
              <p className={styles.reviewIntro}>A starting point. Make it sound like you.</p>

              <div className={styles.editor}>
                <div className={styles.editorTop}>
                  <label htmlFor="review-draft"><UiIcon name="edit" /> Your draft</label>
                  <span>Tap to edit</span>
                </div>
                <textarea id="review-draft" ref={reviewInputRef} value={review}
                  onChange={(event) => editReview(event.target.value)}
                  aria-label="Generated review" aria-describedby="draft-help"
                  disabled={busy} spellCheck />
                <p id="draft-help"><UiIcon name="check" /> Keep only what reflects your experience.</p>
              </div>

              {handoffMessage ? <div className={styles.status} role="status"><UiIcon name="check" /> {handoffMessage}</div> : null}
              {error ? <p className={`customerError ${styles.error}`} role="alert">{error}</p> : null}
              {copyFailed ? (
                <div className={styles.copyRecovery}>
                  <button type="button" className={styles.textAction} onClick={() => {
                    reviewInputRef.current?.focus();
                    reviewInputRef.current?.select();
                  }}>Select review text <UiIcon name="copy" /></button>
                  {location?.googleReviewUrl ? <a className={styles.textAction} href={location.googleReviewUrl} onClick={() => {
                    if (draftId) recordReviewEventOnExit(draftId, "GOOGLE_REVIEW_OPENED");
                  }}>Open Google without copying <UiIcon name="external" /></a> : null}
                </div>
              ) : null}
              {!location?.googleReviewUrl ? <p className={styles.unavailable} role="status">This business hasn't added a Google review link yet. You can still copy your review.</p> : null}

              <div className={styles.actions}>
                <button type="button" className={styles.primary} onClick={() => void copyReview(true)}
                  disabled={!review.trim() || !location?.googleReviewUrl || busy}>
                  <span className={styles.googleIcon} aria-hidden="true">G</span>
                  <span>{isOpeningGoogle ? "Opening Google…" : isCopying ? "Copying…" : "Copy & open Google review"}</span>
                  <UiIcon name="arrow" />
                </button>
                <p className={styles.googleHint}>Next: paste your review on Google, then post.<br /><span>Nothing is posted automatically.</span></p>
                <button type="button" className={styles.copyOnly} disabled={busy || !review.trim()} onClick={() => void copyReview(false)}>
                  <UiIcon name={copied ? "check" : "copy"} /> {copied ? "Copied" : "Copy only"}
                </button>
              </div>
            </div>
          )}
        </section>
        <footer className={styles.footer}>
          <span><UiIcon name="check" /> Your review, your choice.</span>
          <span>Made simple with <strong>QR Review</strong></span>
        </footer>
      </div>
    </main>
  );
}
