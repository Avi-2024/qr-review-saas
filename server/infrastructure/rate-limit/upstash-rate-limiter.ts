import type { RateLimitDecision, RateLimiter } from "@/server/infrastructure/rate-limit/rate-limiter";

const ATOMIC_FIXED_WINDOW_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return {current, ttl}
`.trim();

type RedisResult = {
  result?: [number | string, number | string] | null;
  error?: string;
};

type FetchLike = typeof fetch;

export interface UpstashRateLimiterOptions {
  restUrl: string;
  token: string;
  keyPrefix: string;
  maxRequests: number;
  windowMs: number;
  requestTimeoutMs?: number;
  fallback?: RateLimiter;
  fetcher?: FetchLike;
}

export class UpstashRateLimiter implements RateLimiter {
  private readonly restUrl: string;
  private readonly fetcher: FetchLike;
  private readonly requestTimeoutMs: number;
  private lastFailureLogAt = 0;

  constructor(private readonly options: UpstashRateLimiterOptions) {
    this.restUrl = options.restUrl.replace(/\/+$/, "");
    this.fetcher = options.fetcher ?? fetch;
    this.requestTimeoutMs = options.requestTimeoutMs ?? 1_500;
  }

  async check(key: string): Promise<RateLimitDecision> {
    try {
      return await this.checkDistributed(key);
    } catch (error) {
      this.logFallback(error);
      if (this.options.fallback) return await this.options.fallback.check(key);
      throw error;
    }
  }

  private async checkDistributed(key: string): Promise<RateLimitDecision> {
    const redisKey = `${this.options.keyPrefix}:${key}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      const response = await this.fetcher(this.restUrl, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.options.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify([
          "EVAL",
          ATOMIC_FIXED_WINDOW_SCRIPT,
          1,
          redisKey,
          this.options.windowMs,
        ]),
        signal: controller.signal,
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Distributed rate limiter returned HTTP ${response.status}.`);
      }

      const body = await response.json() as RedisResult;
      if (body.error) throw new Error("Distributed rate limiter command failed.");
      if (!Array.isArray(body.result) || body.result.length < 2) {
        throw new Error("Distributed rate limiter returned an invalid response.");
      }

      const count = Number(body.result[0]);
      const ttlMs = Number(body.result[1]);
      if (!Number.isFinite(count) || !Number.isFinite(ttlMs)) {
        throw new Error("Distributed rate limiter returned non-numeric counters.");
      }

      const allowed = count <= this.options.maxRequests;
      return {
        allowed,
        remaining: Math.max(0, this.options.maxRequests - count),
        retryAfterSeconds: allowed
          ? 0
          : Math.max(1, Math.ceil((ttlMs > 0 ? ttlMs : this.options.windowMs) / 1000)),
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private logFallback(error: unknown) {
    const now = Date.now();
    if (now - this.lastFailureLogAt < 60_000) return;
    this.lastFailureLogAt = now;
    console.error(
      "Distributed rate limiter unavailable; using local fallback.",
      error instanceof Error ? error.message : error,
    );
  }
}
