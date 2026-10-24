import type { Metadata } from "next";
import ReviewExperience from "@/components/ReviewExperience";

export const metadata: Metadata = {
  title: "Share your experience | Raaylo",
  description: "Choose a rating, make your review your own, and share it with Raaylo.",
};

export default function HomePage() {
  return <ReviewExperience />;
}