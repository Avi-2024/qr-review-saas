import ReviewExperience from "@/components/ReviewExperience";

export default async function QrReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <ReviewExperience qrToken={token} />;
}
