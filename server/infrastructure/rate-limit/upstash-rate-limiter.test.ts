import { describe, expect, it, vi } from "vitest";
import type { RateLimiter } from "@/server/infrastructure/rate-limit/rate-limiter";
import { UpstashRateLimiter } from "@/server/infrastructure/rate-limit/upstash-rate-limiter";

const KEY_HASH_SECRET = "test-rate-limit-hash-secret-long-enough";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("UpstashRateLimiter", () => {
  it("uses one atomic EVAL command, hashes identifiers and returns shared remaining capacity", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ result: [2, 9_500] }));
    const limiter = new UpstashRateLimiter({
      restUrl: "https://example.upstash.io/",
      token: "test-token-with-enough-length",
      keyPrefix: "qr-review:generate",
      keyHashSecret: KEY_HASH_SECRET,
      maxRequests: 5,
      windowMs: 10_000,
      fetcher: fetcher as typeof fetch,
    });

    const decision = await limiter.check("ip:127.0.0.1");

    expect(decision).toEqual({ allowed: true, remaining: 3, retryAfterSeconds: 0 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://example.upstash.io");
    const command = JSON.parse(String(init.body));
    expect(command[0]).toBe("EVAL");
    expect(command[2]).toBe(1);
    expect(command[3]).toMatch(/^qr-review:generate:[A-Za-z0-9_-]+$/);
    expect(command[3]).not.toContain("127.0.0.1");
    expect(command[4]).toBe(10_000);
  });

  it("denies requests above the shared limit and reports Redis TTL", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ result: [6, 4_100] }));
    const limiter = new UpstashRateLimiter({
      restUrl: "https://example.upstash.io",
      token: "test-token-with-enough-length",
      keyPrefix: "qr-review:login",
      keyHashSecret: KEY_HASH_SECRET,
      maxRequests: 5,
      windowMs: 10_000,
      fetcher: fetcher as typeof fetch,
    });

    await expect(limiter.check("203.0.113.10")).resolves.toEqual({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 5,
    });
  });

  it("uses a bounded local fallback when Upstash is unavailable", async () => {
    const fallback: RateLimiter = {
      check: vi.fn().mockReturnValue({ allowed: true, remaining: 1, retryAfterSeconds: 0 }),
    };
    const fetcher = vi.fn().mockRejectedValue(new Error("network unavailable"));
    const limiter = new UpstashRateLimiter({
      restUrl: "https://example.upstash.io",
      token: "test-token-with-enough-length",
      keyPrefix: "qr-review:session",
      keyHashSecret: KEY_HASH_SECRET,
      maxRequests: 5,
      windowMs: 10_000,
      fallback,
      fetcher: fetcher as typeof fetch,
    });

    const decision = await limiter.check("198.51.100.20");

    expect(decision.allowed).toBe(true);
    expect(fallback.check).toHaveBeenCalledWith("198.51.100.20");
  });
});
