"use client";

import { useMemo, useState } from "react";
import { generateReview, polishText, Rating, TOPICS } from "@/lib/review";

const GOOGLE_REVIEW_URL = "https://search.google.com/local/writereview?placeid=ChIJIxP2kbaJgzkR6h4dYXKWCcI";
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
  const [rating, setRating] = useState<Rating | 0>(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [review, setReview] = useState("");
  const [variation, setVariation] = useState(0);
  const [screen, setScreen] = useState<"compose" | "review">("compose");
  const [copied, setCopied] = useState(false);

  const selectedCount = selected.length;
  const progress = screen === "review" ? 100 : rating ? 58 : 18;
  const contextLabel = useMemo(() => {
    if (!rating) return "Start with a rating";
    if (!selectedCount) return "Now add a few details";
    return `${selectedCount} detail${selectedCount === 1 ? "" : "s"} selected`;
  }, [rating, selectedCount]);

  function toggleTopic(id: string) {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 4) return current;
      return [...current, id];
    });
  }

  function handleGenerate() {
    if (!rating) return;
    const next = generateReview(rating, selected, note, variation);
    setReview(next);
    setCopied(false);
    setScreen("review");
  }

  async function handleCopy() {
    await copyText(review);
    setCopied(true);
  }

  async function handleGoogle() {
    await copyText(review);
    setCopied(true);
    window.setTimeout(() => {
      window.location.href = GOOGLE_REVIEW_URL;
    }, 380);
  }

  function tryAnother() {
    if (!rating) return;
    const nextVariation = variation + 1;
    setVariation(nextVariation);
    setReview(generateReview(rating, selected, note, nextVariation));
    setCopied(false);
  }

  function reset() {
    setRating(0);
    setSelected([]);
    setNote("");
    setReview("");
    setVariation(0);
    setCopied(false);
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
                <h1>Mangal Traders</h1>
                <p>Fast feedback. No login required.</p>
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
                  {TOPICS.map((topic) => {
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
                    <p>If you type something, we can polish it before generation.</p>
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

              <button className="primaryAction" disabled={!rating} onClick={handleGenerate}>
                <span className="actionIcon">✦</span>
                <span>Generate my review</span>
                <span className="actionArrow">→</span>
              </button>

              <p className="microCopy">Demo uses local generation. Production can switch this action to a low-cost AI endpoint.</p>
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
                  <button onClick={tryAnother}>↻ Try another</button>
                  <button onClick={handleCopy}>{copied ? "✓ Copied" : "⧉ Copy"}</button>
                </div>
              </div>

              <button className="primaryAction googleAction" onClick={handleGoogle} disabled={!review.trim()}>
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
          PARTNER DEMO · WORKING FRONTEND
        </div>

        <div className="partnerHero">
          <span className="panelEyebrow">QR REVIEW SYSTEM</span>
          <h2>From real-world experience to Google review in seconds.</h2>
          <p>A premium, zero-friction customer flow designed for retail, dining, clinics, salons and multi-location businesses.</p>
        </div>

        <div className="flowList">
          {[
            ["01", "Scan", "QR/NFC opens a lightweight mobile page."],
            ["02", "Tap", "Rating + contextual chips capture the experience."],
            ["03", "Generate", "A natural review is prepared in one action."],
            ["04", "Post", "Review is copied and the Google review composer opens."],
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
          <div><strong>0</strong><span>Login steps</span></div>
          <div><strong>0</strong><span>Voice cost</span></div>
          <div><strong>1</strong><span>Generate action</span></div>
          <div><strong>100%</strong><span>Editable</span></div>
        </div>

        <div className="panelFootnote">
          <span>Built for partner validation first.</span>
          <span>Next: API + analytics + merchant dashboard.</span>
        </div>
      </aside>
    </main>
  );
}
