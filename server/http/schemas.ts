import { z } from "zod";

const publicToken = z.string().trim().min(6).max(100).regex(/^[a-zA-Z0-9_-]+$/);
const eventId = z.string().uuid();

export const startSessionSchema = z.object({
  qrToken: publicToken,
  clientSessionId: z.string().uuid(),
});

export const generateReviewSchema = z.object({
  sessionId: z.string().uuid(),
  requestId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  topicIds: z.array(z.string().trim().min(1).max(100)).max(3).default([]),
  note: z.string().trim().max(180).optional(),
  variation: z.number().int().min(0).max(20).default(0),
});

export const reviewEventSchema = z.object({
  eventId,
  type: z.enum(["REVIEW_EDITED", "REVIEW_COPIED", "GOOGLE_REVIEW_OPENED"]),
});

export const sessionEventSchema = z.discriminatedUnion("type", [
  z.object({
    eventId,
    type: z.literal("RATING_SELECTED"),
    rating: z.number().int().min(1).max(5),
  }),
  z.object({
    eventId,
    type: z.literal("TOPIC_SELECTED"),
    topicId: z.string().trim().min(1).max(100),
    selected: z.boolean(),
  }),
  z.object({
    eventId,
    type: z.literal("GENERATE_CLICKED"),
  }),
]);
