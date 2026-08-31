import type {
  CreateSessionInput,
  LocationConfig,
  RecordEventInput,
  ReviewDraft,
  ReviewSession,
  SaveDraftInput,
} from "@/server/domain/review";

export interface ReviewRepository {
  getLocationByPublicId(publicId: string): Promise<LocationConfig | null>;
  getLocationById(id: string): Promise<LocationConfig | null>;
  createSession(input: CreateSessionInput): Promise<ReviewSession>;
  getSession(id: string): Promise<ReviewSession | null>;
  saveDraft(input: SaveDraftInput): Promise<ReviewDraft>;
  getDraft(id: string): Promise<ReviewDraft | null>;
  recordEvent(input: RecordEventInput): Promise<void>;
}
