import { ConflictError, NotFoundError, ValidationError } from "@/server/core/errors";
import type { ReviewGenerator } from "@/server/application/ports/review-generator";
import type { ReviewRepository } from "@/server/application/ports/review-repository";
import type { Rating, ReviewEventType, ReviewTopic } from "@/server/domain/review";

export class ReviewService {
  constructor(
    private readonly repository: ReviewRepository,
    private readonly generator: ReviewGenerator,
    private readonly sessionTtlMinutes: number,
  ) {}

  async getLocation(publicId: string) {
    const location = await this.repository.getLocationByPublicId(publicId);
    if (!location) throw new NotFoundError("Location not found.", "LOCATION_NOT_FOUND");
    return location;
  }

  async getPublicReviewConfig(qrToken: string) {
    const qr = await this.repository.getQrByToken(qrToken);
    if (!qr) throw new NotFoundError("QR code not found or inactive.", "QR_NOT_FOUND");

    const location = await this.repository.getLocationById(qr.locationId);
    if (!location) throw new NotFoundError("Location not found.", "LOCATION_NOT_FOUND");

    return { qr, location };
  }

  async startSession(input: {
    qrToken: string;
    clientSessionId: string;
    userAgent?: string;
    ipHash?: string;
  }) {
    const { qr, location } = await this.getPublicReviewConfig(input.qrToken);
    const expiresAt = new Date(Date.now() + this.sessionTtlMinutes * 60_000);

    const result = await this.repository.createSession({
      locationId: location.id,
      qrCodeId: qr.id,
      clientSessionId: input.clientSessionId,
      userAgent: input.userAgent,
      ipHash: input.ipHash,
      expiresAt,
    });

    return { ...result, location, qr };
  }

  async generate(input: {
    sessionId: string;
    requestId: string;
    rating: Rating;
    topicIds: string[];
    note?: string;
    variation: number;
  }) {
    const session = await this.requireActiveSession(input.sessionId);
    const location = await this.repository.getLocationById(session.locationId);
    if (!location) throw new NotFoundError("Location not found.", "LOCATION_NOT_FOUND");

    const uniqueTopicIds = [...new Set(input.topicIds)];
    if (uniqueTopicIds.length > 4) {
      throw new ValidationError("A maximum of 4 review topics can be selected.");
    }

    const topicMap = new Map(location.topics.map((topic) => [topic.id, topic]));
    const topics: ReviewTopic[] = [];

    for (const id of uniqueTopicIds) {
      const topic = topicMap.get(id);
      if (!topic) throw new ValidationError("One or more selected review topics are invalid.");
      topics.push(topic);
    }

    const claim = await this.repository.claimGeneration(session.id, input.requestId);

    if (claim.status === "completed") {
      const existingDraft = await this.repository.getDraft(claim.draftId);
      if (!existingDraft) {
        throw new ConflictError("Generation state is inconsistent. Please retry.", "GENERATION_STATE_INVALID");
      }
      return { draft: existingDraft, location, replayed: true };
    }

    if (claim.status === "in_progress") {
      throw new ConflictError("This review is already being generated.", "GENERATION_IN_PROGRESS");
    }

    try {
      const generated = await this.generator.generate({
        businessName: location.name,
        rating: input.rating,
        topics,
        note: input.note,
        variation: input.variation,
      });

      const draft = await this.repository.saveGeneratedDraft({
        sessionId: session.id,
        requestId: input.requestId,
        rating: input.rating,
        topicIds: uniqueTopicIds,
        note: input.note,
        text: generated.text,
        provider: generated.provider,
        variation: input.variation,
        eventType: input.variation > 0 ? "REVIEW_REGENERATED" : "REVIEW_GENERATED",
      });

      return { draft, location, replayed: false };
    } catch (error) {
      await this.repository.releaseGenerationClaim(session.id, input.requestId).catch(() => undefined);
      throw error;
    }
  }

  async recordDraftEvent(input: {
    draftId: string;
    type: ReviewEventType;
    clientEventId: string;
  }) {
    const supportedEvents: ReviewEventType[] = [
      "REVIEW_EDITED",
      "REVIEW_COPIED",
      "GOOGLE_REVIEW_OPENED",
    ];
    if (!supportedEvents.includes(input.type)) {
      throw new ValidationError("Unsupported review event type.");
    }

    const draft = await this.repository.getDraft(input.draftId);
    if (!draft) throw new NotFoundError("Review draft not found.", "DRAFT_NOT_FOUND");

    await this.requireActiveSession(draft.sessionId);
    await this.repository.recordEvent({
      sessionId: draft.sessionId,
      draftId: draft.id,
      clientEventId: input.clientEventId,
      type: input.type,
    });
  }

  async recordSessionEvent(input: {
    sessionId: string;
    type: "RATING_SELECTED" | "TOPIC_SELECTED" | "GENERATE_CLICKED";
    clientEventId: string;
    metadata?: Record<string, unknown>;
  }) {
    const session = await this.requireActiveSession(input.sessionId);

    if (input.type === "RATING_SELECTED") {
      const rating = Number(input.metadata?.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        throw new ValidationError("Invalid rating event.");
      }
    }

    if (input.type === "TOPIC_SELECTED") {
      const topicId = String(input.metadata?.topicId || "");
      const location = await this.repository.getLocationById(session.locationId);
      if (!location?.topics.some((topic) => topic.id === topicId)) {
        throw new ValidationError("Invalid topic event.");
      }
    }

    await this.repository.recordEvent({
      sessionId: session.id,
      clientEventId: input.clientEventId,
      type: input.type,
      metadata: input.metadata,
    });
  }

  private async requireActiveSession(sessionId: string) {
    const session = await this.repository.getSession(sessionId);
    if (!session) throw new NotFoundError("Review session not found.", "SESSION_NOT_FOUND");

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      throw new ConflictError("Review session expired. Start a new scan session.", "SESSION_EXPIRED");
    }

    return session;
  }
}
