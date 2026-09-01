import { createHmac } from "node:crypto";

export function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}

export function hashIp(ip: string, secret?: string) {
  if (!ip || ip === "unknown") return undefined;

  const key = secret || "development-only-ip-hash-secret";
  return createHmac("sha256", key).update(ip).digest("hex").slice(0, 32);
}
