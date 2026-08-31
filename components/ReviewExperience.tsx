"use client";

import { useEffect, useMemo, useState } from "react";
import { polishText, type Rating } from "@/lib/review";
import {
  generateReviewDraft,
  getLocation,
  recordReviewEvent,
  startReviewSession,
  type LocationDto,
} from "@/lib/review-api";

const LOCATION_PUBLIC_ID = "mangal-traders";
const FALLBACK_REVIEW_URL = "https://search.google.com/local/writereview?placeid=ChIJIxP2kbaJgzkR6h4dYXKWCcI";
const ratingLabels = ["", "Very poor", "Could be better", "Okay", "Good", "Excellent"];

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const area = document.createElement("textarea");
  area.value = value;
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  document.execCommand("copy");
  area.remove();
}

export default function ReviewExperience() {
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

  useEffect(() => {
    let active = true;
    getLocation(LOCATION_PUBLIC_ID)
      .then((data) => active && setLocation(data))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const selectedCount = selected.length;
  const progress = screen === "review" ? 100 : rating ? 58 : 18;
  const contextLabel = useMemo(() => {
    if (!rating) return "Start with a rating";
    if (!selectedCount) return "Now add a few details";
    return `${selectedCount} detail${selectedCount === 1 ? "" : "s"} selected`;
  }, [rating, selectedCount]);

  async function ensureSession() {
    if (sessionId) return sessionId;
    const created = await startReviewSession(LOCATION_PUBLIC_ID);
    setSessionId(created.sessionId);
    return created.sessionId;
  }

  function toggleTopic(id: string) {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 4) return current;
      return [...current, id];
    });
  }

  async function createDraft(nextVariation: number) {
    if (!rating) return;
    setError("");
    setIsGenerating(true);
    try {
      const activeSessionId = await ensureSession();
      const generated = await generateReviewDraft({
        sessionId: activeSessionId,
        rating,
        topicIds: selected,
        note: note.trim() || undefined,
        variation: nextVariation,
      });
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

  async function handleCopy() {
    await copyText(review);
    setCopied(true);
    if (draftId) void recordReviewEvent(draftId, "REVIEW_COPIED").catch(() => undefined);
  }

  async function handleGoogle() {
    await copyText(review);
    setCopied(true);
    if (draftId) void recordReviewEvent(draftId, "GOOGLE_REVIEW_OPENED").catch(() => undefined);
    window.setTimeout(() => {
      window.location.href = location?.googleReviewUrl || FALLBACK_REVIEW_URL;
    }, 280);
  }

  function reset() {
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
                      onClick={() => setRating(value as Rating)}
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
                    <p>Pick up to 4 details. This keeps the review authentic and specific.</p>
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
                    <p>Keep the customer in control; enhancement never changes the intended sentiment.</p>
                  </div>
                  <button
                    className="textAction"
                    onClick={() => setNote(polishText(note))}
                    disabled={!note.trim()}
                  >
                    ✦ Enhance
                  </button>
                </div>

                <div className="noteBox">
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    maxLength={180}
                    placeholder="e.g. staff was helpful and I found everything quickly"
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

              <p className="microCopy">Generated through the backend API. No external AI key is required for this partner demo.</p>
            </div>
          ) : (
            <div className="contentPane reviewPane">
              <button className="backLink" onClick={() => setScreen("compose")}>← Edit selections</button>

              <div className="successGlyph">✓</div>
              <span className="eyebrow">STEP 03</span>
              <h2>Your review is ready.</h2>
              <p className="reviewLead">Keep it, edit it, or generate another version. You stay in control.</p>

              <div className="reviewEditor">
                <textarea value={review} onChange={(event) => setReview(event.target.value)} aria-label="Generated review" />
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
                  <p>Your review is copied. Paste it into Google’s review box, then tap Post.</p>
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
          PARTNER DEMO · FULL-STACK FLOW
        </div>

        <div className="partnerHero">
          <span className="panelEyebrow">QR REVIEW SYSTEM</span>
          <h2>From real-world experience to Google review in seconds.</h2>
          <p>A premium, zero-friction customer flow backed by a clean API, analytics events and a production-ready PostgreSQL path.</p>
        </div>

        <div className="flowList">
          {[
            ["01", "Scan", "Public location configuration loads from the backend."],
            ["02", "Tap", "Rating + contextual chips capture the customer experience."],
            ["03", "Generate", "Backend validates, generates and stores an editable draft."],
            ["04", "Post", "Copy/open events are recorded before Google review handoff."],
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
          <div><strong>API</strong><span>Versioned routes</span></div>
          <div><strong>PG</strong><span>Production adapter</span></div>
          <div><strong>12</strong><span>Rate limit / 10m</span></div>
          <div><strong>100%</strong><span>Editable</span></div>
        </div>

        <div className="panelFootnote">
          <span>Clean service + repository architecture.</span>
          <span>Next: merchant auth, dashboard and AI provider.</span>
        </div>
      </aside>
    </main>
  );
}
