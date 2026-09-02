import { z } from "zod";

export const merchantLoginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(200),
});

export const merchantLocationCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  subtitle: z.string().trim().max(180).optional(),
  googlePlaceId: z.string().trim().min(5).max(200),
  publicId: z.string().trim().min(2).max(80).optional(),
});

export const merchantLocationUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  subtitle: z.string().trim().max(180).optional(),
  googlePlaceId: z.string().trim().min(5).max(200).optional(),
  isActive: z.boolean().optional(),
});

export const merchantQrCreateSchema = z.object({
  locationId: z.string().uuid(),
  name: z.string().trim().min(2).max(100),
  sourceType: z.string().trim().min(2).max(40).optional(),
  reference: z.string().trim().max(120).optional(),
});

export const merchantQrStatusSchema = z.object({
  isActive: z.boolean(),
});
