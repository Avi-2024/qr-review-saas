import type { Metadata } from "next";
import ReviewExperience from "@/components/ReviewExperience";

/**
 * NFC tags contain a standard HTTPS URL to this route.
 * Use the same public token and review session flow as QR links.
 * A unique touchpoint token per physical card retains placement analytics.
 */
export const metadata: Metadata = {
  title: "Share your experience | Raaylo",
  description: "Choose a rating, make your review your own, and share it with Raaylo.",
};

export default async function NfcReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <ReviewExperience key={token} qrToken={token} />;
}