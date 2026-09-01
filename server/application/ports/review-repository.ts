import type {
  CreateSessionInput,
  CreateSessionResult,
  GenerationClaim,
  LocationConfig,
  QrCodeConfig,
  RecordEventInput,
  ReviewDraft,
  ReviewSession,
  SaveDraftInput,
} from "@/server/domain/review";

export interface ReviewRepository {
  getLocationByPublicId(publicId: string): Promise<LocationConfig | null>;
  getLocationById(id: string): Promise<LocationConfig | null>;
  getQrByToken(publicToken: string): Promise<QrCodeConfig | null>;
  createSession(input: CreateSessionInput): Promise<CreateSessionResult>;
  getSession(id: string): Promise<ReviewSession | null>;
  claimGeneration(sessionId: string, requestId: string): Promise<GenerationClaim>;
  releaseGenerationClaim(sessionId: string, requestId: string): Promise<void>;
  saveGeneratedDraft(input: SaveDraftInput): Promise<ReviewDraft>;
  getDraft(id: string): Promise<ReviewDraft | null>;
  recordEvent(input: RecordEventInput): Promise<void>;
}
