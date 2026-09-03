"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import GooglePlacePicker from "@/components/merchant/GooglePlacePicker";
import { BUSINESS_PRESETS, getBusinessPreset } from "@/lib/business-presets";

type Stage = "business" | "location" | "topics" | "qr" | "ready" | "complete";

type OnboardingState = {
  organization: {
    id: string;
    name: string;
    businessType: string | null;
    onboardingStage: Stage;
    onboardingCompletedAt: string | null;
  };
  locations: Array<{
    id: string;
    publicId: string;
    name: string;
    subtitle: string;
    googlePlaceId: string;
    googleReviewUrl: string;
    isActive: boolean;
    createdAt: string;
  }>;
  topics: Array<{
    id: string;
    label: string;
    icon: string;
    sortOrder: number;
    isActive: boolean;
  }>;
  qrCodes: Array<{
    id: string;
    locationId: string;
    locationName: string;
    publicToken: string;
    name: string;
    sourceType: string;
    reference: string | null;
    isActive: boolean;
    createdAt: string;
  }>;
};

type TopicDraft = { label: string; icon: string };

const STEPS = [
  ["business", "Business"],
  ["location", "Location"],
  ["topics", "Review topics"],
  ["qr", "First QR"],
  ["ready", "Ready"],
] as const;

const STAGE_INDEX: Record<Stage, number> = {
  business: 0,
  location: 1,
  topics: 2,
  qr: 3,
  ready: 4,
  complete: 5,
};

async function readJson(response: Response) {
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    throw new Error(body?.error?.message || "Something went wrong. Please try again.");
  }
  return body;
}

async function copyText(value: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Continue to fallback.
  }

  let area: HTMLTextAreaElement | null = null;
  try {
    area = document.createElement("textarea");
    area.value = value;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area?.remove();
  }
}

export default function OnboardingWizard({
  initialState,
  merchantName,
  placesSearchEnabled,
}: {
  initialState: OnboardingState;
  merchantName: string;
  placesSearchEnabled: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const knownPreset = BUSINESS_PRESETS.find((preset) => preset.id === state.organization.businessType);
  const [presetId, setPresetId] = useState(knownPreset?.id ?? "other");
  const [customType, setCustomType] = useState(knownPreset ? "" : state.organization.businessType ?? "");
  const [businessName, setBusinessName] = useState(state.organization.name);
  const [locationName, setLocationName] = useState(state.organization.name);
  const [googlePlaceId, setGooglePlaceId] = useState("");
  const [topicDrafts, setTopicDrafts] = useState<TopicDraft[]>(() => getBusinessPreset(state.organization.businessType).topics.map((topic) => ({ ...topic })));
  const [qrName, setQrName] = useState("");
  const [qrReference, setQrReference] = useState("");

  const stage = state.organization.onboardingStage;
  const activeIndex = STAGE_INDEX[stage];
  const activePreset = useMemo(() => getBusinessPreset(state.organization.businessType), [state.organization.businessType]);
  const primaryLocation = state.locations[0] ?? null;
  const firstQr = state.qrCodes[0] ?? null;

  useEffect(() => {
    if (stage !== "topics") return;
    setTopicDrafts(getBusinessPreset(state.organization.businessType).topics.map((topic) => ({ ...topic })));
  }, [stage, state.organization.businessType]);

  useEffect(() => {
    if (stage === "location" && !locationName.trim()) setLocationName(state.organization.name);
  }, [stage, state.organization.name, locationName]);

  useEffect(() => {
    if (stage === "qr" && !qrName && activePreset.qrSuggestions[0]) setQrName(activePreset.qrSuggestions[0]);
  }, [activePreset, qrName, stage]);

  async function refreshState() {
    const response = await fetch("/api/v1/merchant/onboarding", { cache: "no-store" });
    const body = await readJson(response);
    setState(body.onboarding);
    return body.onboarding as OnboardingState;
  }

  async function saveBusiness(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    const businessType = presetId === "other" ? customType.trim() || "other" : presetId;
    setLoading("business");
    setError("");
    try {
      await readJson(await fetch("/api/v1/merchant/onboarding/business", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ businessName, businessType }),
      }));
      const nextState = await refreshState();
      setLocationName(nextState.organization.name);
      setGooglePlaceId("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save business details.");
    } finally {
      setLoading(null);
    }
  }

  async function saveLocation(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    if (!googlePlaceId.trim()) {
      setError("Select your Google business or enter a Google Place ID before continuing.");
      return;
    }

    setLoading("location");
    setError("");
    try {
      await readJson(await fetch("/api/v1/merchant/onboarding/location", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: locationName, googlePlaceId }),
      }));
      await refreshState();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save your first location.");
    } finally {
      setLoading(null);
    }
  }

  function updateTopic(index: number, label: string) {
    setTopicDrafts((current) => current.map((topic, itemIndex) => itemIndex === index ? { ...topic, label } : topic));
  }

  function removeTopic(index: number) {
    setTopicDrafts((current) => current.length <= 3 ? current : current.filter((_, itemIndex) => itemIndex !== index));
  }

  function addTopic() {
    setTopicDrafts((current) => current.length >= 8 ? current : [...current, { label: "", icon: "•" }]);
  }

  async function saveTopics(event: React.FormEvent) {
    event.preventDefault();
    if (loading || !primaryLocation) return;
    setLoading("topics");
    setError("");
    try {
      await readJson(await fetch("/api/v1/merchant/onboarding/topics", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locationId: primaryLocation.id, topics: topicDrafts }),
      }));
      await refreshState();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save review topics.");
    } finally {
      setLoading(null);
    }
  }

  async function saveQr(event: React.FormEvent) {
    event.preventDefault();
    if (loading || !primaryLocation) return;
    setLoading("qr");
    setError("");
    try {
      await readJson(await fetch("/api/v1/merchant/onboarding/qr", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          locationId: primaryLocation.id,
          name: qrName,
          sourceType: qrName || "general",
          reference: qrReference || undefined,
        }),
      }));
      await refreshState();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create your first QR code.");
    } finally {
      setLoading(null);
    }
  }

  async function finish() {
    if (loading) return;
    setLoading("complete");
    setError("");
    try {
      await readJson(await fetch("/api/v1/merchant/onboarding/complete", { method: "POST" }));
      router.replace("/dashboard");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not finish setup.");
      setLoading(null);
    }
  }

  async function copyPublicLink() {
    if (!firstQr) return;
    const didCopy = await copyText(`${window.location.origin}/r/${firstQr.publicToken}`);
    setCopied(didCopy);
    if (!didCopy) setError("The browser blocked automatic copying. Open the review page and copy the URL manually.");
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <main className="onboardingShell">
      <section className="onboardingAside">
        <div className="onboardingBrand"><span className="merchantLogoMark">QR</span><strong>QR Review</strong></div>
        <div className="onboardingAsideCopy">
          <span className="merchantEyebrow">GUIDED SETUP</span>
          <h1>Get your first working review QR ready.</h1>
          <p>We’ll configure only what you need to start collecting authentic customer reviews. You can expand locations and QR touchpoints later.</p>
        </div>
        <ol className="onboardingSteps">
          {STEPS.map(([step, label], index) => {
            const complete = activeIndex > index;
            const active = activeIndex === index;
            return (
              <li key={step} className={`${complete ? "complete" : ""} ${active ? "active" : ""}`}>
                <span>{complete ? "✓" : index + 1}</span>
                <div><strong>{label}</strong><small>{complete ? "Done" : active ? "In progress" : "Next"}</small></div>
              </li>
            );
          })}
        </ol>
        <p className="onboardingSignedIn">Signed in as <strong>{merchantName}</strong></p>
      </section>

      <section className="onboardingMain">
        <div className="onboardingCard">
          <div className="onboardingProgress"><span style={{ width: `${Math.min(100, ((activeIndex + 1) / STEPS.length) * 100)}%` }} /></div>

          {stage === "business" ? (
            <form onSubmit={saveBusiness} className="onboardingStepPane">
              <div className="onboardingHeading"><span className="merchantEyebrow">STEP 1 OF 5</span><h2>Tell us about your business</h2><p>This only helps us suggest useful review topics. The platform stays flexible for any sector.</p></div>
              <div className="merchantField"><label>Business name</label><input value={businessName} onChange={(event)=>setBusinessName(event.target.value)} placeholder="Your business name" required /></div>
              <div className="onboardingPresetGrid">
                {BUSINESS_PRESETS.map((preset) => (
                  <button key={preset.id} type="button" className={presetId === preset.id ? "selected" : ""} onClick={() => { setPresetId(preset.id); if (preset.id !== "other") setCustomType(""); }}>
                    <strong>{preset.label}</strong><span>{preset.description}</span>
                  </button>
                ))}
              </div>
              {presetId === "other" ? <div className="merchantField"><label>Your business type</label><input value={customType} onChange={(event)=>setCustomType(event.target.value)} placeholder="e.g. Pet grooming, event venue, repair service" /></div> : null}
              {error ? <div className="merchantError" role="alert">{error}</div> : null}
              <div className="onboardingActions"><button className="merchantBtn" disabled={Boolean(loading)}>{loading === "business" ? "Saving…" : "Continue to location →"}</button></div>
            </form>
          ) : null}

          {stage === "location" ? (
            <form onSubmit={saveLocation} className="onboardingStepPane">
              <div className="onboardingHeading"><span className="merchantEyebrow">STEP 2 OF 5</span><h2>Connect your first Google location</h2><p>Find the exact business or branch customers should review. We store only its Google Place ID.</p></div>
              <div className="merchantField">
                <label>Location label</label>
                <input value={locationName} onChange={(event)=>setLocationName(event.target.value)} placeholder="e.g. Main Branch" required />
                <small>This is your internal label in QR Review and can differ from the Google listing name.</small>
              </div>
              <GooglePlacePicker enabled={placesSearchEnabled} value={googlePlaceId} onChange={setGooglePlaceId} disabled={Boolean(loading)} />
              <div className="onboardingInfo"><strong>Why this matters</strong><span>The final customer button opens Google’s official review composer for the selected location. QR Review never auto-posts a review.</span></div>
              {error ? <div className="merchantError" role="alert">{error}</div> : null}
              <div className="onboardingActions"><button className="merchantBtn" disabled={Boolean(loading) || !googlePlaceId.trim()}>{loading === "location" ? "Creating location…" : "Save location →"}</button></div>
            </form>
          ) : null}

          {stage === "topics" ? (
            <form onSubmit={saveTopics} className="onboardingStepPane">
              <div className="onboardingHeading"><span className="merchantEyebrow">STEP 3 OF 5</span><h2>Choose what customers can mention</h2><p>We suggested topics for your business type. Edit them freely. Customers can select up to three when leaving feedback.</p></div>
              <div className="onboardingTopicEditor">
                {topicDrafts.map((topic, index) => (
                  <div className="onboardingTopicRow" key={index}>
                    <span>{topic.icon || "•"}</span>
                    <input value={topic.label} onChange={(event)=>updateTopic(index,event.target.value)} maxLength={60} required />
                    <button type="button" onClick={()=>removeTopic(index)} disabled={topicDrafts.length <= 3}>Remove</button>
                  </div>
                ))}
              </div>
              <button type="button" className="onboardingAddTopic" onClick={addTopic} disabled={topicDrafts.length >= 8}>+ Add another topic</button>
              <p className="onboardingHint">Keep topics neutral. The customer’s rating and own words determine sentiment.</p>
              {error ? <div className="merchantError" role="alert">{error}</div> : null}
              <div className="onboardingActions"><button className="merchantBtn" disabled={Boolean(loading)}>{loading === "topics" ? "Saving topics…" : "Use these topics →"}</button></div>
            </form>
          ) : null}

          {stage === "qr" ? (
            <form onSubmit={saveQr} className="onboardingStepPane">
              <div className="onboardingHeading"><span className="merchantEyebrow">STEP 4 OF 5</span><h2>Where will your first QR be placed?</h2><p>Name the physical touchpoint so its scan and conversion performance can be measured separately.</p></div>
              <div className="onboardingSuggestionRow">
                {activePreset.qrSuggestions.map((suggestion) => <button type="button" key={suggestion} className={qrName === suggestion ? "selected" : ""} onClick={()=>setQrName(suggestion)}>{suggestion}</button>)}
              </div>
              <div className="onboardingTwoCols">
                <div className="merchantField"><label>QR name / touchpoint</label><input value={qrName} onChange={(event)=>setQrName(event.target.value)} placeholder="e.g. Reception" required /></div>
                <div className="merchantField"><label>Reference (optional)</label><input value={qrReference} onChange={(event)=>setQrReference(event.target.value)} placeholder="e.g. desk-01, table-12" /></div>
              </div>
              <div className="onboardingInfo"><strong>Independent analytics</strong><span>Later, each QR can show its own scans and Google-open conversion so you know which placement performs best.</span></div>
              {error ? <div className="merchantError" role="alert">{error}</div> : null}
              <div className="onboardingActions"><button className="merchantBtn" disabled={Boolean(loading)}>{loading === "qr" ? "Creating QR…" : "Create my first QR →"}</button></div>
            </form>
          ) : null}

          {stage === "ready" && firstQr ? (
            <div className="onboardingStepPane onboardingReady">
              <div className="onboardingHeading"><span className="merchantEyebrow">STEP 5 OF 5</span><h2>Your first QR is ready 🎉</h2><p>Test the customer flow now, then download the QR and place it where customers naturally finish their experience.</p></div>
              <div className="onboardingQrReady">
                <div className="onboardingQrPreview"><img src={`/api/v1/merchant/qr-codes/${firstQr.id}/svg`} alt={`QR code for ${firstQr.name}`} /></div>
                <div className="onboardingQrMeta">
                  <span className="merchantEyebrow">FIRST TOUCHPOINT</span>
                  <h3>{firstQr.name}</h3>
                  <p>{firstQr.locationName}</p>
                  <code>/r/{firstQr.publicToken}</code>
                  <div className="onboardingQrActions">
                    <button type="button" onClick={()=>window.open(`/r/${firstQr.publicToken}`,"_blank","noopener,noreferrer")}>Test review page</button>
                    <button type="button" onClick={()=>void copyPublicLink()}>{copied ? "Copied ✓" : "Copy link"}</button>
                    <button type="button" onClick={()=>window.open(`/api/v1/merchant/qr-codes/${firstQr.id}/svg?download=1`,"_blank","noopener,noreferrer")}>Download SVG</button>
                  </div>
                </div>
              </div>
              {error ? <div className="merchantError" role="alert">{error}</div> : null}
              <div className="onboardingActions onboardingFinish"><div><strong>Setup complete</strong><span>You can add more locations and QR touchpoints from the dashboard anytime.</span></div><button type="button" className="merchantBtn" onClick={()=>void finish()} disabled={Boolean(loading)}>{loading === "complete" ? "Opening dashboard…" : "Finish & open dashboard →"}</button></div>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
