import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ReviewService } from "@/server/application/services/review-service";
import { MemoryReviewRepository } from "@/server/infrastructure/repositories/memory-review-repository";
import { LocalReviewGenerator } from "@/server/infrastructure/review-generators/local-review-generator";

function createService(sessionTtlMinutes = 60) {
  return new ReviewService(
    new MemoryReviewRepository(),
    new LocalReviewGenerator(),
    sessionTtlMinutes,
  );
}

describe("ReviewService", () => {
  it("returns the same session for a retried scan request", async () => {
    const service = createService();
    const clientSessionId = randomUUID();

    const first = await service.startSession({
      qrToken: "mangal-counter-demo",
      clientSessionId,
    });
    const retry = await service.startSession({
      qrToken: "mangal-counter-demo",
      clientSessionId,
    });

    expect(first.created).toBe(true);
    expect(retry.created).toBe(false);
    expect(retry.session.id).toBe(first.session.id);
  });

  it("replays the same draft for a retried generation request", async () => {
    const service = createService();
    const session = await service.startSession({
      qrToken: "mangal-counter-demo",
      clientSessionId: randomUUID(),
    });
    const requestId = randomUUID();

    const first = await service.generate({
      sessionId: session.session.id,
      requestId,
      rating: 5,
      topicIds: ["staff", "value"],
      note: "The overall experience was good, although it felt a little expensive",
      variation: 0,
    });
    const retry = await service.generate({
      sessionId: session.session.id,
      requestId,
      rating: 5,
      topicIds: ["staff", "value"],
      note: "The overall experience was good, although it felt a little expensive",
      variation: 0,
    });

    expect(first.replayed).toBe(false);
    expect(retry.replayed).toBe(true);
    expect(retry.draft.id).toBe(first.draft.id);
    expect(retry.draft.text).toBe(first.draft.text);
  });

  it("allows up to three topics and rejects a fourth", async () => {
    const service = createService();
    const session = await service.startSession({
      qrToken: "mangal-counter-demo",
      clientSessionId: randomUUID(),
    });

    await expect(service.generate({
      sessionId: session.session.id,
      requestId: randomUUID(),
      rating: 4,
      topicIds: ["quality", "staff", "value"],
      variation: 0,
    })).resolves.toMatchObject({ replayed: false });

    await expect(service.generate({
      sessionId: session.session.id,
      requestId: randomUUID(),
      rating: 4,
      topicIds: ["quality", "staff", "value", "speed"],
      variation: 0,
    })).rejects.toMatchObject({ code: "VALIDATION_ERROR", statusCode: 400 });
  });

  it("rejects generation after a session expires", async () => {
    const service = createService(-1);
    const session = await service.startSession({
      qrToken: "mangal-counter-demo",
      clientSessionId: randomUUID(),
    });

    await expect(service.generate({
      sessionId: session.session.id,
      requestId: randomUUID(),
      rating: 4,
      topicIds: [],
      variation: 0,
    })).rejects.toMatchObject({ code: "SESSION_EXPIRED", statusCode: 409 });
  });
});
