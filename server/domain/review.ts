export type Rating = 1 | 2 | 3 | 4 | 5;

export type ReviewEventType =
  | "QR_SCANNED"
  | "RATING_SELECTED"
  | "TOPIC_SELECTED"
  | "GENERATE_CLICKED"
  | "REVIEW_GENERATED"
  | "REVIEW_REGENERATED"
  | "REVIEW_EDITED"
  | "REVIEW_COPIED"
  | "GOOGLE_REVIEW_OPENED";

export interface ReviewTopic {
  id: string;
  label: string;
  icon: string;
  sortOrder: number;
}

export interface LocationConfig {
  id: string;
  publicId: string;
  name: string;
  subtitle: string;
  googlePlaceId: string;
  googleReviewUrl: string;
  topics: ReviewTopic[];
}

export interface QrCodeConfig {
  id: string;
  locationId: string;
  publicToken: string;
  name: string;
  sourceType: string;
  reference: string | null;
}

export interface ReviewSession {
  id: string;
  locationId: string;
  qrCodeId: string;
  clientSessionId: string;
  startedAt: Date;
  expiresAt: Date;
}

export interface ReviewDraft {
  id: string;
  sessionId: string;
  requestId: string;
  rating: Rating;
  topicIds: string[];
  note: string | null;
  text: string;
  provider: string;
  variation: number;
  createdAt: Date;
}

export interface CreateSessionInput {
  locationId: string;
  qrCodeId: string;
  clientSessionId: string;
  userAgent?: string;
  ipHash?: string;
  expiresAt: Date;
}

export interface CreateSessionResult {
  session: ReviewSession;
  created: boolean;
}

export interface SaveDraftInput {
  sessionId: string;
  requestId: string;
  rating: Rating;
  topicIds: string[];
  note?: string;
  text: string;
  provider: string;
  variation: number;
  eventType: "REVIEW_GENERATED" | "REVIEW_REGENERATED";
}

export interface RecordEventInput {
  sessionId: string;
  draftId?: string;
  clientEventId?: string;
  type: ReviewEventType;
  metadata?: Record<string, unknown>;
}

export type GenerationClaim =
  | { status: "claimed" }
  | { status: "completed"; draftId: string }
  | { status: "in_progress" };
