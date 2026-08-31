export type Rating = 1 | 2 | 3 | 4 | 5;

export type ReviewEventType =
  | "SESSION_STARTED"
  | "REVIEW_GENERATED"
  | "REVIEW_REGENERATED"
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

export interface ReviewSession {
  id: string;
  locationId: string;
  startedAt: Date;
}

export interface ReviewDraft {
  id: string;
  sessionId: string;
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
  userAgent?: string;
  ipHash?: string;
}

export interface SaveDraftInput {
  sessionId: string;
  rating: Rating;
  topicIds: string[];
  note?: string;
  text: string;
  provider: string;
  variation: number;
}

export interface RecordEventInput {
  sessionId: string;
  draftId?: string;
  type: ReviewEventType;
  metadata?: Record<string, unknown>;
}
