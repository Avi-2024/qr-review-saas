import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  verifyRazorpayCheckoutSignature,
  verifyRazorpayWebhookSignature,
} from "@/server/billing/providers/razorpay/razorpay-signatures";

describe("Razorpay signatures", () => {
  const secret = "test-only-signature-secret";

  it("binds a checkout signature to both the payment and subscription", () => {
    const signature = createHmac("sha256", secret).update("pay_test|sub_test").digest("hex");
    const input = { paymentId: "pay_test", subscriptionId: "sub_test", signature, keySecret: secret };
    expect(verifyRazorpayCheckoutSignature(input)).toBe(true);
    expect(verifyRazorpayCheckoutSignature({ ...input, subscriptionId: "sub_other" })).toBe(false);
    expect(verifyRazorpayCheckoutSignature({ ...input, paymentId: "pay_other" })).toBe(false);
    expect(verifyRazorpayCheckoutSignature({ ...input, keySecret: "wrong-secret" })).toBe(false);
  });

  it("verifies the exact webhook bytes and rejects malformed signatures", () => {
    const rawBody = '{"event":"subscription.activated"}';
    const signature = createHmac("sha256", secret).update(rawBody).digest("hex");
    const input = { rawBody, signature, webhookSecret: secret };
    expect(verifyRazorpayWebhookSignature(input)).toBe(true);
    expect(verifyRazorpayWebhookSignature({ ...input, rawBody: rawBody + " " })).toBe(false);
    for (const invalid of ["", "0", "z".repeat(64), "a".repeat(64), signature + "00"]) {
      expect(verifyRazorpayWebhookSignature({ ...input, signature: invalid })).toBe(false);
    }
  });
});
