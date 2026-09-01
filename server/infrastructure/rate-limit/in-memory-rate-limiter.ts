interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export class InMemoryRateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private checks = 0;

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number,
    private readonly cleanupInterval = 100,
  ) {}

  check(key: string): RateLimitDecision {
    const now = Date.now();
    this.checks += 1;

    if (this.checks % this.cleanupInterval === 0) {
      this.cleanupExpired(now);
    }

    const existing = this.buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, remaining: this.maxRequests - 1, retryAfterSeconds: 0 };
    }

    if (existing.count >= this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
      };
    }

    existing.count += 1;
    return {
      allowed: true,
      remaining: this.maxRequests - existing.count,
      retryAfterSeconds: 0,
    };
  }

  private cleanupExpired(now: number) {
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}
