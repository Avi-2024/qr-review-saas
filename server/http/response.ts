import { ZodError } from "zod";
import { AppError } from "@/server/core/errors";

export function ok<T>(data: T, init?: ResponseInit) {
  return Response.json({ success: true, data }, { status: 200, ...init });
}

export function created<T>(data: T) {
  return Response.json({ success: true, data }, { status: 201 });
}

export function handleRouteError(error: unknown) {
  if (error instanceof ZodError) {
    return Response.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request payload.",
          details: error.flatten(),
        },
      },
      { status: 400 },
    );
  }

  if (error instanceof AppError) {
    return Response.json(
      {
        success: false,
        error: { code: error.code, message: error.message, details: error.details },
      },
      { status: error.statusCode },
    );
  }

  console.error("Unhandled route error", error);
  return Response.json(
    { success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong." } },
    { status: 500 },
  );
}
