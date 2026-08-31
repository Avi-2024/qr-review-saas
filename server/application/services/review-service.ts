import { NotFoundError, ValidationError } from "@/server/core/errors";
import type { ReviewGenerator } from "@/server/application/ports/review-generator";
import type { ReviewRepository } from "@/server/application/ports/review-repository";
import type { Rating, ReviewEventType, ReviewTopic } from "@/server/domain/review";

export class ReviewService {
  constructor(
    private readonly repository: ReviewRepository,
    private readonly generator: ReviewGenerator,
  ) {}

  async getLocation(publicId: string) {
    const location = await this.repository.getLocationByPublicId(publicId);
    if (!location) throw new NotFoundError("Location not found.", "LOCATION_NOT_FOUND");
    return location;
  }

  async startSession(input: { publicId: string; userAgent?: string; ipHash?: string }) {
    const location = await this.getLocation(input.publicId);
    const session = await this.repository.createSession({
      locationId: location.id,
      userAgent: input.userAgent,
      ipHash: input.ipHash,
    });

    await this.repository.recordEvent({
      sessionId: session.id,
      type: "SESSION_STARTED",
    });

    return { session, location };
  }

  async generate(input: {
    sessionId: string;
    rating: Rating;
    topicIds: string[];
    note?: string;
    variation: number;
  }) {
    const session = await this.repository.getSession(input.sessionId);
    if (!session) throw new NotFoundError("Review session not found.", "SESSION_NOT_FOUND");

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
      if (!topic) {
        throw new ValidationError("One or more selected review topics are invalid.");
      }
      topics.push(topic);
    }

    const generated = await this.generator.generate({
      businessName: location.name,
      rating: input.rating,
      topics,
      note: input.note,
      variation: input.variation,
    });

    const draft = await this.repository.saveDraft({
      sessionId: session.id,
      rating: input.rating,
      topicIds: uniqueTopicIds,
      note: input.note,
      text: generated.text,
      provider: generated.provider,
      variation: input.variation,
    });

    await this.repository.recordEvent({
      sessionId: session.id,
      draftId: draft.id,
      type: input.variation > 0 ? "REVIEW_REGENERATED" : "REVIEW_GENERATED",
      metadata: { provider: generated.provider },
    });

    return { draft, location };
  }

  async recordDraftEvent(input: { draftId: string; type: ReviewEventType }) {
    const supportedEvents: ReviewEventType[] = ["REVIEW_COPIED", "GOOGLE_REVIEW_OPENED"];
    if (!supportedEvents.includes(input.type)) {
      throw new ValidationError("Unsupported review event type.");
    }

    const draft = await this.repository.getDraft(input.draftId);
    if (!draft) throw new NotFoundError("Review draft not found.", "DRAFT_NOT_FOUND");

    await this.repository.recordEvent({
      sessionId: draft.sessionId,
      draftId: draft.id,
      type: input.type,
    });
  }
}
