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

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { message?: string };
}

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const body = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || !body.success || !body.data) {
    throw new Error(body.error?.message || "Request failed.");
  }
  return body.data;
}

export function getLocation(publicId: string) {
  return apiRequest<LocationDto>(`/api/v1/public/locations/${encodeURIComponent(publicId)}`);
}

export function startReviewSession(publicId: string) {
  return apiRequest<{ sessionId: string; location: Pick<LocationDto, "publicId" | "name" | "googleReviewUrl"> }>(
    "/api/v1/public/sessions",
    { method: "POST", body: JSON.stringify({ publicId }) },
  );
}

export function generateReviewDraft(input: {
  sessionId: string;
  rating: number;
  topicIds: string[];
  note?: string;
  variation: number;
}) {
  return apiRequest<{ draftId: string; text: string; provider: string; googleReviewUrl: string }>(
    "/api/v1/public/reviews/generate",
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function recordReviewEvent(reviewId: string, type: "REVIEW_COPIED" | "GOOGLE_REVIEW_OPENED") {
  return apiRequest<{ recorded: boolean }>(`/api/v1/public/reviews/${reviewId}/events`, {
    method: "POST",
    body: JSON.stringify({ type }),
  });
}
