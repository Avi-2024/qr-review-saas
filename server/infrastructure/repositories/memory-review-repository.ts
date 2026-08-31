import { randomUUID } from "node:crypto";
import type { ReviewRepository } from "@/server/application/ports/review-repository";
import type {
  CreateSessionInput,
  LocationConfig,
  RecordEventInput,
  ReviewDraft,
  ReviewSession,
  SaveDraftInput,
} from "@/server/domain/review";

const MANGAL_TRADERS: LocationConfig = {
  id: "loc_mangal_traders",
  publicId: "mangal-traders",
  name: "Mangal Traders",
  subtitle: "Fast feedback. No login required.",
  googlePlaceId: "ChIJIxP2kbaJgzkR6h4dYXKWCcI",
  googleReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJIxP2kbaJgzkR6h4dYXKWCcI",
  topics: [
    { id: "quality", label: "Product Quality", icon: "📦", sortOrder: 10 },
    { id: "staff", label: "Staff Interaction", icon: "🤝", sortOrder: 20 },
    { id: "pricing", label: "Pricing", icon: "₹", sortOrder: 30 },
    { id: "availability", label: "Product Availability", icon: "✓", sortOrder: 40 },
    { id: "cleanliness", label: "Cleanliness", icon: "✨", sortOrder: 50 },
    { id: "speed", label: "Service Speed", icon: "⚡", sortOrder: 60 },
    { id: "variety", label: "Product Variety", icon: "🛍️", sortOrder: 70 },
    { id: "value", label: "Overall Value", icon: "◎", sortOrder: 80 },
  ],
};

export class MemoryReviewRepository implements ReviewRepository {
  private readonly locations = new Map([[MANGAL_TRADERS.id, MANGAL_TRADERS]]);
  private readonly sessions = new Map<string, ReviewSession>();
  private readonly drafts = new Map<string, ReviewDraft>();
  private readonly events: RecordEventInput[] = [];

  async getLocationByPublicId(publicId: string) {
    return [...this.locations.values()].find((location) => location.publicId === publicId) ?? null;
  }

  async getLocationById(id: string) {
    return this.locations.get(id) ?? null;
  }

  async createSession(input: CreateSessionInput) {
    const session: ReviewSession = {
      id: randomUUID(),
      locationId: input.locationId,
      startedAt: new Date(),
    };
    this.sessions.set(session.id, session);
    return session;
  }

  async getSession(id: string) {
    return this.sessions.get(id) ?? null;
  }

  async saveDraft(input: SaveDraftInput) {
    const draft: ReviewDraft = {
      id: randomUUID(),
      sessionId: input.sessionId,
      rating: input.rating,
      topicIds: [...input.topicIds],
      note: input.note?.trim() || null,
      text: input.text,
      provider: input.provider,
      variation: input.variation,
      createdAt: new Date(),
    };
    this.drafts.set(draft.id, draft);
    return draft;
  }

  async getDraft(id: string) {
    return this.drafts.get(id) ?? null;
  }

  async recordEvent(input: RecordEventInput) {
    this.events.push(input);
  }
}
