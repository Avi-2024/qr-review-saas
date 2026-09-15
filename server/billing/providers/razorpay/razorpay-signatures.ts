import { createHmac, timingSafeEqual } from "node:crypto";

function safeEqualHex(expected: string, received: string) {
  if (!/^[a-f0-9]+$/i.test(received) || expected.length !== received.length) return false;
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(received, "hex");
  if (expectedBuffer.length !== receivedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

export function verifyRazorpayCheckoutSignature(input: {
  paymentId: string;
  subscriptionId: string;
  signature: string;
  keySecret: string;
}) {
  const expected = createHmac("sha256", input.keySecret)
    .update(`${input.paymentId}|${input.subscriptionId}`)
    .digest("hex");
  return safeEqualHex(expected, input.signature);
}

export function verifyRazorpayWebhookSignature(input: {
  rawBody: string;
  signature: string;
  webhookSecret: string;
}) {
  const expected = createHmac("sha256", input.webhookSecret)
    .update(input.rawBody)
    .digest("hex");
  return safeEqualHex(expected, input.signature);
}
