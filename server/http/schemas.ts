import { z } from "zod";

export const startSessionSchema = z.object({
  publicId: z.string().trim().min(2).max(100),
});

export const generateReviewSchema = z.object({
  sessionId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  topicIds: z.array(z.string().trim().min(1).max(100)).max(4).default([]),
  note: z.string().trim().max(180).optional(),
  variation: z.number().int().min(0).max(20).default(0),
});

export const reviewEventSchema = z.object({
  type: z.enum(["REVIEW_COPIED", "GOOGLE_REVIEW_OPENED"]),
});
