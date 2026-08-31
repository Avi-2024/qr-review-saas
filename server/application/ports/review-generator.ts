import type { Rating, ReviewTopic } from "@/server/domain/review";

export interface GenerateReviewInput {
  businessName: string;
  rating: Rating;
  topics: ReviewTopic[];
  note?: string;
  variation: number;
}

export interface GenerateReviewOutput {
  text: string;
  provider: string;
}

export interface ReviewGenerator {
  generate(input: GenerateReviewInput): Promise<GenerateReviewOutput>;
}
