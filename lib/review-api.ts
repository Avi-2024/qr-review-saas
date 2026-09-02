export interface ReviewTopicDto {
  id: string;
  label: string;
  icon: string;
  sortOrder: number;
}

export interface LocationDto {
  publicId: string;
  name: string;
  subtitle: string;
  googleReviewUrl: string;
  topics: ReviewTopicDto[];
}

export interface QrDto {
  token: string;
  name: string;
  sourceType?: string;
  reference?: string | null;
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { message?: string; code?: string };
}

export class ReviewApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ReviewApiError";
  }
}

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: init?.body
      ? { "content-type": "application/json", ...(init?.headers ?? {}) }
      : init?.headers,
    cache: "no-store",
  });

  let body: ApiEnvelope<T> | null = null;
  try {
    body = (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new ReviewApiError(
      response.ok ? "The server returned an invalid response." : "Request failed.",
      response.status,
    );
  }

  if (!response.ok || !body.success || body.data === undefined) {
    throw new ReviewApiError(
      body.error?.message || "Request failed.",
      response.status,
      body.error?.code,
    );
  }

  return body.data;
}

export function getQrConfig(qrToken: string) {
  return apiRequest<{ qr: QrDto; location: LocationDto }>(
    `/api/v1/public/qr/${encodeURIComponent(qrToken)}`,
  );
}

export function startReviewSession(qrToken: string, clientSessionId: string) {
  return apiRequest<{
    sessionId: string;
    expiresAt: string;
    qr: QrDto;
    location: LocationDto;
  }>("/api/v1/public/sessions", {
    method: "POST",
    body: JSON.stringify({ qrToken, clientSessionId }),
  });
}

export function generateReviewDraft(input: {
  sessionId: string;
  requestId: string;
  rating: number;
  topicIds: string[];
  note?: string;
  variation: number;
}) {
  return apiRequest<{
    draftId: string;
    text: string;
    provider: string;
    googleReviewUrl: string;
    replayed: boolean;
  }>("/api/v1/public/reviews/generate", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function recordReviewEvent(
  reviewId: string,
  type: "REVIEW_EDITED" | "REVIEW_COPIED" | "GOOGLE_REVIEW_OPENED",
  eventId = crypto.randomUUID(),
) {
  return apiRequest<{ recorded: boolean }>(`/api/v1/public/reviews/${reviewId}/events`, {
    method: "POST",
    keepalive: true,
    body: JSON.stringify({ eventId, type }),
  });
}

export function recordReviewEventOnExit(
  reviewId: string,
  type: "GOOGLE_REVIEW_OPENED",
) {
  const url = `/api/v1/public/reviews/${reviewId}/events`;
  const payload = JSON.stringify({ eventId: crypto.randomUUID(), type });

  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const sent = navigator.sendBeacon(
      url,
      new Blob([payload], { type: "application/json" }),
    );
    if (sent) return;
  }

  void fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => undefined);
}

export function recordSessionEvent(
  sessionId: string,
  event:
    | { type: "RATING_SELECTED"; rating: number }
    | { type: "TOPIC_SELECTED"; topicId: string; selected: boolean }
    | { type: "GENERATE_CLICKED" },
) {
  return apiRequest<{ recorded: boolean }>(`/api/v1/public/sessions/${sessionId}/events`, {
    method: "POST",
    keepalive: true,
    body: JSON.stringify({ eventId: crypto.randomUUID(), ...event }),
  });
}
