import { describe, expect, it, vi } from "vitest";
import { RazorpayClient } from "@/server/billing/providers/razorpay/razorpay-client";

describe("RazorpayClient", () => {
  it("sends subscription parameters with server-side authentication", async () => {
    const entity = { id: "sub_test", plan_id: "plan_test", status: "created" };
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json(entity));
    const client = new RazorpayClient("test-key", "test-secret", 500, fetchImpl);
    await expect(client.createSubscription({
      planId: "plan_test", totalCount: 12,
      startAt: new Date("2026-10-13T00:00:00Z"), notes: { organizationId: "org_test" },
    })).resolves.toEqual(entity);

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.razorpay.com/v1/subscriptions");
    expect(init?.headers).toMatchObject({
      authorization: `Basic ${Buffer.from("test-key:test-secret").toString("base64")}`,
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      plan_id: "plan_test", total_count: 12, quantity: 1, customer_notify: true,
      notes: { organizationId: "org_test" }, start_at: 1791849600,
    });
  });

  it.each([[429, 503], [500, 502]])("maps upstream status %s to %s", async (status, expectedStatus) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response("provider error", { status }));
    await expect(new RazorpayClient("key", "secret", 500, fetchImpl).fetchSubscription("sub_test"))
      .rejects.toMatchObject({ code: "RAZORPAY_UPSTREAM_ERROR", statusCode: expectedStatus });
  });

  it("rejects incomplete provider responses", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ id: "sub_test" }));
    await expect(new RazorpayClient("key", "secret", 500, fetchImpl).fetchSubscription("sub_test"))
      .rejects.toMatchObject({ code: "RAZORPAY_INVALID_RESPONSE" });
  });

  it("maps aborted and unavailable requests without exposing credentials", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new DOMException("aborted", "AbortError"));
    const client = new RazorpayClient("key", "secret", 500, fetchImpl);
    await expect(client.fetchSubscription("sub_test")).rejects.toMatchObject({ code: "RAZORPAY_TIMEOUT", statusCode: 504 });
    fetchImpl.mockRejectedValue(new Error("network failed"));
    await expect(client.fetchSubscription("sub_test")).rejects.toMatchObject({ code: "RAZORPAY_UNAVAILABLE", statusCode: 502 });
  });
});
