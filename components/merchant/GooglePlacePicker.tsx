"use client";

import { useEffect, useId, useState } from "react";

type GooglePlacePrediction = {
  placeId: string;
  mainText: string;
  secondaryText: string;
  fullText: string;
};

type SelectedGooglePlace = {
  placeId: string;
  displayName: string;
  formattedAddress: string;
};

function newPlacesSessionToken() {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

async function readJson(response: Response) {
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    throw new Error(body?.error?.message || "Something went wrong. Please try again.");
  }
  return body;
}

export default function GooglePlacePicker({
  enabled,
  value,
  onChange,
  disabled = false,
}: {
  enabled: boolean;
  value: string;
  onChange: (placeId: string) => void;
  disabled?: boolean;
}) {
  const inputId = useId();
  const [manualMode, setManualMode] = useState(!enabled);
  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState<GooglePlacePrediction[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<SelectedGooglePlace | null>(null);
  const [sessionToken, setSessionToken] = useState("");
  const [status, setStatus] = useState<"idle" | "searching" | "selecting">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (manualMode || !enabled || sessionToken) return;
    setSessionToken(newPlacesSessionToken());
  }, [enabled, manualMode, sessionToken]);

  useEffect(() => {
    if (value || !selectedPlace) return;
    setSelectedPlace(null);
    setQuery("");
    if (enabled && !manualMode) setSessionToken(newPlacesSessionToken());
  }, [enabled, manualMode, selectedPlace, value]);

  useEffect(() => {
    if (manualMode || !enabled || selectedPlace || disabled) {
      setPredictions([]);
      return;
    }

    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2 || !sessionToken) {
      setPredictions([]);
      setMessage("");
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setStatus("searching");
      setMessage("");
      try {
        const response = await fetch("/api/v1/merchant/google-places/autocomplete", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ input: trimmedQuery, sessionToken }),
          signal: controller.signal,
        });
        const body = await readJson(response);
        const nextPredictions = (body.data?.predictions ?? []) as GooglePlacePrediction[];
        setPredictions(nextPredictions);
        if (!nextPredictions.length) setMessage("No matching Google businesses found. Try adding the city or area name.");
      } catch (cause) {
        if (controller.signal.aborted) return;
        setPredictions([]);
        setMessage(cause instanceof Error ? cause.message : "Could not search Google businesses.");
      } finally {
        if (!controller.signal.aborted) setStatus("idle");
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [disabled, enabled, manualMode, query, selectedPlace, sessionToken]);

  async function selectPlace(prediction: GooglePlacePrediction) {
    if (status === "selecting" || !sessionToken || disabled) return;
    setStatus("selecting");
    setMessage("");
    try {
      const response = await fetch("/api/v1/merchant/google-places/details", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ placeId: prediction.placeId, sessionToken }),
      });
      const body = await readJson(response);
      const place = body.data?.place as SelectedGooglePlace;
      setSelectedPlace(place);
      onChange(place.placeId);
      setPredictions([]);
      setQuery(prediction.fullText);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not verify that Google business.");
    } finally {
      setStatus("idle");
    }
  }

  function changeSelectedPlace() {
    setSelectedPlace(null);
    onChange("");
    setQuery("");
    setPredictions([]);
    setMessage("");
    setSessionToken(newPlacesSessionToken());
  }

  function enableManualMode() {
    setManualMode(true);
    setSelectedPlace(null);
    onChange("");
    setQuery("");
    setPredictions([]);
    setMessage("");
  }

  function enableSearchMode() {
    setManualMode(false);
    setSelectedPlace(null);
    onChange("");
    setQuery("");
    setPredictions([]);
    setMessage("");
    setSessionToken(newPlacesSessionToken());
  }

  if (manualMode || !enabled) {
    return (
      <div className="onboardingManualPlace">
        {!enabled ? <div className="onboardingPlacesMessage">Google business search is not configured in this environment. Manual Place ID still works.</div> : null}
        <div className="merchantField">
          <label htmlFor={inputId}>Google Place ID</label>
          <input id={inputId} value={value} onChange={(event)=>onChange(event.target.value)} placeholder="ChIJ..." required disabled={disabled} />
          <small>Used only to open Google’s official review composer for this location.</small>
        </div>
        {enabled ? <button type="button" className="onboardingManualLink" onClick={enableSearchMode} disabled={disabled}>← Search Google Maps instead</button> : null}
      </div>
    );
  }

  return (
    <div className="onboardingGoogleSearch">
      {!selectedPlace ? (
        <>
          <div className="merchantField onboardingGoogleSearchField">
            <label htmlFor={inputId}>Find your business on Google Maps</label>
            <div className="onboardingGoogleInputWrap">
              <input
                id={inputId}
                value={query}
                onChange={(event)=>{ setQuery(event.target.value); setMessage(""); }}
                placeholder="Business name + city or area"
                autoComplete="off"
                aria-autocomplete="list"
                aria-expanded={predictions.length > 0}
                disabled={disabled}
              />
              {status === "searching" ? <span>Searching…</span> : null}
            </div>
            <small>Choose the exact branch where this QR will be used.</small>
          </div>

          {predictions.length ? (
            <div className="onboardingGoogleResults" role="listbox" aria-label="Google Maps business suggestions">
              {predictions.map((prediction) => (
                <button
                  type="button"
                  key={prediction.placeId}
                  onClick={()=>void selectPlace(prediction)}
                  disabled={status === "selecting" || disabled}
                  role="option"
                  aria-selected="false"
                >
                  <span className="onboardingGooglePin">⌖</span>
                  <span className="onboardingGoogleResultCopy">
                    <strong>{prediction.mainText}</strong>
                    <small>{prediction.secondaryText || prediction.fullText}</small>
                  </span>
                  <span className="onboardingGoogleSelect">Select</span>
                </button>
              ))}
              <div className="onboardingGoogleAttribution">Google Maps</div>
            </div>
          ) : null}

          {message ? <div className="onboardingPlacesMessage" role="status" aria-live="polite">{message}</div> : null}
        </>
      ) : (
        <div className="onboardingSelectedPlace">
          <div className="onboardingSelectedPlaceIcon">✓</div>
          <div>
            <span className="merchantEyebrow">GOOGLE LOCATION SELECTED</span>
            <strong>{selectedPlace.displayName}</strong>
            {selectedPlace.formattedAddress ? <p>{selectedPlace.formattedAddress}</p> : null}
            <small>Google Maps · Place ID verified</small>
          </div>
          <button type="button" onClick={changeSelectedPlace} disabled={disabled}>Change</button>
        </div>
      )}

      <button type="button" className="onboardingManualLink" onClick={enableManualMode} disabled={disabled}>Can’t find your business? Enter Place ID manually</button>
    </div>
  );
}
