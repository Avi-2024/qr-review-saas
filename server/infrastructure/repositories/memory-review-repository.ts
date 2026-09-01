import { randomUUID } from "node:crypto";
import type { ReviewRepository } from "@/server/application/ports/review-repository";
import type {
  CreateSessionInput,
  GenerationClaim,
  LocationConfig,
  QrCodeConfig,
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

const MANGAL_COUNTER_QR: QrCodeConfig = {
  id: "qr_mangal_counter",
  locationId: MANGAL_TRADERS.id,
  publicToken: "mangal-counter-demo",
  name: "Main Counter",
  sourceType: "counter",
  reference: "main-counter",
};

type MemoryGenerationState =
  | { status: "in_progress" }
  | { status: "completed"; draftId: string };

export class MemoryReviewRepository implements ReviewRepository {
  private readonly locations = new Map([[MANGAL_TRADERS.id, MANGAL_TRADERS]]);
  private readonly qrCodes = new Map([[MANGAL_COUNTER_QR.id, MANGAL_COUNTER_QR]]);
  private readonly sessions = new Map<string, ReviewSession>();
  private readonly sessionsByClientKey = new Map<string, string>();
  private readonly generationClaims = new Map<string, MemoryGenerationState>();
  private readonly drafts = new Map<string, ReviewDraft>();
  private readonly events: RecordEventInput[] = [];
  private readonly clientEventIds = new Set<string>();

  async getLocationByPublicId(publicId: string) {
    return [...this.locations.values()].find((location) => location.publicId === publicId) ?? null;
  }

  async getLocationById(id: string) {
    return this.locations.get(id) ?? null;
  }

  async getQrByToken(publicToken: string) {
    return [...this.qrCodes.values()].find((qr) => qr.publicToken === publicToken) ?? null;
  }

  async createSession(input: CreateSessionInput) {
    const clientKey = `${input.qrCodeId}:${input.clientSessionId}`;
    const existingId = this.sessionsByClientKey.get(clientKey);
    const existing = existingId ? this.sessions.get(existingId) : undefined;

    if (existing) {
      return { session: existing, created: false };
    }

    const session: ReviewSession = {
      id: randomUUID(),
      locationId: input.locationId,
      qrCodeId: input.qrCodeId,
      clientSessionId: input.clientSessionId,
      startedAt: new Date(),
      expiresAt: input.expiresAt,
    };

    this.sessions.set(session.id, session);
    this.sessionsByClientKey.set(clientKey, session.id);
    this.events.push({ sessionId: session.id, type: "QR_SCANNED" });

    return { session, created: true };
  }

  async getSession(id: string) {
    return this.sessions.get(id) ?? null;
  }

  async claimGeneration(sessionId: string, requestId: string): Promise<GenerationClaim> {
    const key = this.generationKey(sessionId, requestId);
    const existing = this.generationClaims.get(key);

    if (!existing) {
      this.generationClaims.set(key, { status: "in_progress" });
      return { status: "claimed" };
    }

    if (existing.status === "completed") {
      return { status: "completed", draftId: existing.draftId };
    }

    return { status: "in_progress" };
  }

  async releaseGenerationClaim(sessionId: string, requestId: string) {
    const key = this.generationKey(sessionId, requestId);
    const existing = this.generationClaims.get(key);
    if (existing?.status === "in_progress") this.generationClaims.delete(key);
  }

  async saveGeneratedDraft(input: SaveDraftInput) {
    const draft: ReviewDraft = {
      id: randomUUID(),
      sessionId: input.sessionId,
      requestId: input.requestId,
      rating: input.rating,
      topicIds: [...input.topicIds],
      note: input.note?.trim() || null,
      text: input.text,
      provider: input.provider,
      variation: input.variation,
      createdAt: new Date(),
    };

    this.drafts.set(draft.id, draft);
    this.generationClaims.set(this.generationKey(input.sessionId, input.requestId), {
      status: "completed",
      draftId: draft.id,
    });
    this.events.push({
      sessionId: input.sessionId,
      draftId: draft.id,
      type: input.eventType,
      metadata: { provider: input.provider },
    });

    return draft;
  }

  async getDraft(id: string) {
    return this.drafts.get(id) ?? null;
  }

  async recordEvent(input: RecordEventInput) {
    if (input.clientEventId) {
      if (this.clientEventIds.has(input.clientEventId)) return;
      this.clientEventIds.add(input.clientEventId);
    }

    this.events.push(input);
  }

  private generationKey(sessionId: string, requestId: string) {
    return `${sessionId}:${requestId}`;
  }
}
