import { createHash } from "node:crypto";

export function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}

export function hashIp(ip: string) {
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}
