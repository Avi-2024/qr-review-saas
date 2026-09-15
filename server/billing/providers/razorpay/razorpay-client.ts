import { AppError } from "@/server/core/errors";

export type RazorpaySubscriptionStatus =
  | "created"
  | "authenticated"
  | "active"
  | "pending"
  | "halted"
  | "cancelled"
  | "completed"
  | "expired"
  | "paused";

export interface RazorpaySubscriptionEntity {
  id: string;
  plan_id: string;
  customer_id?: string | null;
  status: RazorpaySubscriptionStatus | string;
  current_start?: number | null;
  current_end?: number | null;
  start_at?: number | null;
  charge_at?: number | null;
  total_count?: number;
  paid_count?: number;
  notes?: Record<string, string> | string[];
}

export class RazorpayClient {
  private readonly authorization: string;

  constructor(
    keyId: string,
    keySecret: string,
    private readonly timeoutMs = 5_000,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.authorization = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
  }

  async createSubscription(input: {
    planId: string;
    totalCount: number;
    startAt?: Date;
    notes: Record<string, string>;
  }): Promise<RazorpaySubscriptionEntity> {
    const payload: Record<string, unknown> = {
      plan_id: input.planId,
      total_count: input.totalCount,
      quantity: 1,
      customer_notify: true,
      notes: input.notes,
    };
    if (input.startAt) payload.start_at = Math.floor(input.startAt.getTime() / 1000);

    return this.request("/subscriptions", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async fetchSubscription(subscriptionId: string): Promise<RazorpaySubscriptionEntity> {
    return this.request(`/subscriptions/${encodeURIComponent(subscriptionId)}`, { method: "GET" });
  }

  private async request(path: string, init: RequestInit): Promise<RazorpaySubscriptionEntity> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`https://api.razorpay.com/v1${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          authorization: this.authorization,
          "content-type": "application/json",
          ...(init.headers ?? {}),
        },
      });

      if (!response.ok) {
        throw new AppError(
          "Payment provider request failed. Please try again.",
          response.status === 429 ? 503 : 502,
          "RAZORPAY_UPSTREAM_ERROR",
          { providerStatus: response.status },
        );
      }

      const body = await response.json().catch(() => null) as RazorpaySubscriptionEntity | null;
      if (!body?.id || !body.plan_id || !body.status) {
        throw new AppError(
          "Payment provider returned an invalid response.",
          502,
          "RAZORPAY_INVALID_RESPONSE",
        );
      }
      return body;
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new AppError("Payment provider timed out. Please try again.", 504, "RAZORPAY_TIMEOUT");
      }
      throw new AppError("Payment provider is temporarily unavailable.", 502, "RAZORPAY_UNAVAILABLE");
    } finally {
      clearTimeout(timeout);
    }
  }
}
