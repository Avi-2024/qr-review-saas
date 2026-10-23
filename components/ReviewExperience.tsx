"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
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

  async function handleCopy() {
    if (!review.trim()) return;
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
  }

  async function handleGoogle() {
    if (!review.trim() || !location?.googleReviewUrl || isOpeningGoogle) return;
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
    window.setTimeout(() => window.location.assign(location.googleReviewUrl), 350);
  }

  const isDemo = qrToken === "mangal-counter-demo";

  return (
    <main className="productShell customerFlowV2 minimalCustomerFlow">
      <header className="experienceNav">
        <span className="productWordmark"><span className="productLogo"><UiIcon name="qr" /></span> QR Review<span className="wordmarkDot">.</span></span>
        <div className="experienceNavRight">
          {isDemo ? <><span className="demoBadge">Interactive demo</span><Link href="/login">Business workspace <UiIcon name="external" /></Link></> : <span className="reviewNavLabel">THE CUSTOMER EXPERIENCE</span>}
        </div>
      </header>
      <section className="experienceStage" aria-label="Customer review">
        <div className="phoneCard">
          <header className="merchantHeader customerHeader">
            <div className="merchantBrand">
              <div className="brandMark" aria-hidden="true">{businessInitials(location?.name)}</div>
              <div>
                <span className="businessEyebrow">SHARE YOUR EXPERIENCE</span>
                <h1>{location?.name || (error ? "Review unavailable" : "Getting ready…")}</h1>
                <p>{location?.subtitle || "A quick review, in your own words."}</p>
              </div>
            </div>
            <span className="headerTouchpoint"><UiIcon name="qr" /></span>
          </header>
          {screen === "compose" ? (
            <div className="contentPane composePane minimalComposePane">
              <section className="heroQuestion customerQuestion">
                <span className="sectionEyebrow">YOUR EXPERIENCE</span>
                <h2 ref={composeHeadingRef} tabIndex={-1}>How was your experience?</h2>
                <p>Tap a star. We'll prepare a short review you can edit.</p>
                <div className="ratingGrid" role="group" aria-label="Select rating">
                  {([1, 2, 3, 4, 5] as Rating[]).map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`ratingButton ${rating === value ? "active" : ""}`}
                      onClick={() => selectRating(value)}
                      aria-label={`${value} star${value === 1 ? "" : "s"}`}
                      aria-pressed={rating === value}
                      disabled={!location || isGenerating}
                    >
                      <UiIcon name="star" /><small>{value}</small>
                    </button>
                  ))}
                </div>
                <div className="ratingFeedback" aria-live="polite">
                  <strong>{rating ? ratingLabels[rating] : "Choose 1–5 stars"}</strong>
                  <span>{isGenerating ? "Preparing your review…" : "Every rating is welcome"}</span>
                </div>
              </section>
              {isGenerating ? <div className="minimalLoading" role="status"><UiIcon name="sparkle" /> Preparing your review…</div> : null}
              {error ? <p className="customerError" role="alert">{error}</p> : null}
              {error && !location ? (
                <button type="button" className="retryAction" onClick={() => {
                  setError("");
                  void ensureSession().catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load the review."));
                }}>Try loading again <UiIcon name="arrow" /></button>
              ) : null}
              {error && location && rating && !isGenerating ? (
                <button type="button" className="retryAction" onClick={() => void createDraft(rating)}>Retry review <UiIcon name="arrow" /></button>
              ) : null}
              <p className="minimalTrust"><UiIcon name="check" /> You can edit every word before sharing.</p>
            </div>
          ) : (
            <div className="contentPane reviewPane customerReviewPane minimalReviewPane">
              <button type="button" className="backLink" disabled={isOpeningGoogle} onClick={changeRating}><span aria-hidden="true">←</span> Change rating</button>
              <div className="reviewReadyHeader">
                <div className="successGlyph"><UiIcon name="check" /></div>
                <div>
                  <span className="sectionEyebrow">{rating} / 5 STARS</span>
                  <h2 ref={reviewHeadingRef} tabIndex={-1}>Your review is ready</h2>
                  <p className="reviewLead">Check the wording, make it yours, then continue.</p>
                </div>
              </div>
              <div className="reviewEditor">
                <div className="reviewEditorHeading"><span><UiIcon name="edit" /> YOUR DRAFT</span><span>Editable</span></div>
                <textarea value={review} onChange={(event) => editReview(event.target.value)} aria-label="Generated review" disabled={isOpeningGoogle} />
                <div className="reviewEditorFoot"><span>Share only what reflects your experience.</span><span>{review.length} characters</span></div>
              </div>
              {handoffMessage ? <div className="handoffStatus" role="status">{handoffMessage}</div> : null}
              {error ? <p className="customerError" role="alert">{error}</p> : null}
              <button type="button" className="primaryAction googleAction" onClick={() => void handleGoogle()}
                disabled={!review.trim() || !location?.googleReviewUrl || isOpeningGoogle}>
                <span className="googleG">G</span>
                <span>{isOpeningGoogle ? "Opening Google…" : "Copy & open Google review"}</span>
                <span className="actionArrow"><UiIcon name="external" /></span>
              </button>
              <p className="pasteInstruction">Paste your review into Google and post it only if it reflects your experience.</p>
              <div className="secondaryReviewActions minimalSecondaryActions">
                <button type="button" disabled={isOpeningGoogle || !review.trim()} onClick={() => void handleCopy()}>
                  <UiIcon name={copied ? "check" : "copy"} /> {copied ? "Copied" : "Copy only"}
                </button>
              </div>
              {copyFailed && location?.googleReviewUrl ? (
                <a className="retryAction minimalManualGoogle" href={location.googleReviewUrl} onClick={() => {
                  if (draftId) recordReviewEventOnExit(draftId, "GOOGLE_REVIEW_OPENED");
                }}>Open Google without copying <UiIcon name="external" /></a>
              ) : null}
            </div>
          )}
        </div>
        <footer className="customerFooter"><span>No sign-in needed.</span><span>Powered by <strong>QR Review</strong></span></footer>
      </section>
      <aside className="partnerPanel">
        <div className="partnerHero">
          <span className="panelEyebrow"><i /> SHARE YOUR EXPERIENCE</span>
          <h2>One tap.<br /><span>Your own words.</span></h2>
          <p>Choose a rating, check the draft, and decide what you'd like to share.</p>
        </div>
        <div className="experienceGuide">
          <div><span>01</span><strong>Choose your rating</strong><p>Every experience matters.</p></div>
          <div><span>02</span><strong>Review & share</strong><p>Edit freely, then open Google.</p></div>
        </div>
        <div className="panelFootnote"><span><UiIcon name="check" /> Every rating welcome</span><span><UiIcon name="edit" /> You control the final words</span></div>
      </aside>
      <footer className="experiencePageFooter"><span>QR Review / Thoughtful feedback, made simple.</span><span>YOUR EXPERIENCE. YOUR WORDS.</span></footer>
    </main>
  );
}
