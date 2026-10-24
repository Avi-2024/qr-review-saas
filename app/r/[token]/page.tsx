import type { Metadata } from "next";
import ReviewExperience from "@/components/ReviewExperience";

export const metadata: Metadata = {
  title: "Share your experience | Raaylo",
  description: "Choose a rating, make your review your own, and share it with Raaylo.",
};

export default async function QrReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <ReviewExperience key={token} qrToken={token} />;
}