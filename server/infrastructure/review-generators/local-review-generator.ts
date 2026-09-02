import type {
  GenerateReviewInput,
  GenerateReviewOutput,
  ReviewGenerator,
} from "@/server/application/ports/review-generator";

function polish(value: string) {
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned) return "";
  const sentence = cleaned[0].toUpperCase() + cleaned.slice(1);
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
}

function joinNatural(values: string[]) {
  if (values.length <= 1) return values[0] ?? "";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

export class LocalReviewGenerator implements ReviewGenerator {
  async generate(input: GenerateReviewInput): Promise<GenerateReviewOutput> {
    const { businessName, rating, topics, note, variation } = input;
    const sentences: string[] = [this.opening(businessName, rating, variation)];

    if (topics.length) {
      const labels = topics.map((topic) => topic.label.toLowerCase());
      sentences.push(`The main parts of my experience were ${joinNatural(labels)}.`);
    }

    if (note?.trim()) sentences.push(polish(note));
    sentences.push(this.closing(rating, variation));

    return {
      text: sentences.filter(Boolean).join(" "),
      provider: "local-template-v3",
    };
  }

  private opening(businessName: string, rating: number, variation: number) {
    const alternates = {
      1: [`Overall, I had a very poor experience with ${businessName}.`, `My overall experience with ${businessName} was disappointing.`],
      2: [`Overall, my experience with ${businessName} was below expectations.`, `My experience with ${businessName} could have been better overall.`],
      3: [`Overall, my experience with ${businessName} was average.`, `My experience with ${businessName} was mixed overall.`],
      4: [`Overall, I had a good experience with ${businessName}.`, `My experience with ${businessName} was good overall.`],
      5: [`Overall, I had a great experience with ${businessName}.`, `My experience with ${businessName} was excellent overall.`],
    } as const;

    return alternates[rating as keyof typeof alternates][variation % 2];
  }

  private closing(rating: number, variation: number) {
    if (rating >= 4) return variation % 2 ? "I would consider choosing them again." : "Overall, I was satisfied with the experience.";
    if (rating === 3) return variation % 2 ? "There is still room for improvement." : "Overall, it was an average experience.";
    return variation % 2 ? "I hope the overall experience improves." : "There is clear room for improvement.";
  }
}
