import type {
  GenerateReviewInput,
  GenerateReviewOutput,
  ReviewGenerator,
} from "@/server/application/ports/review-generator";

const positive: Record<string, string> = {
  quality: "the product quality was good",
  staff: "the staff interaction was helpful and polite",
  pricing: "the pricing felt reasonable",
  availability: "the items I needed were available",
  cleanliness: "the store felt clean and organised",
  speed: "the service was quick",
  variety: "there was a good variety of products",
  value: "the overall value was good",
};

const mixed: Record<string, string> = {
  quality: "the product quality was noticeable",
  staff: "the staff interaction stood out",
  pricing: "the pricing was something I noticed",
  availability: "product availability was noticeable",
  cleanliness: "cleanliness stood out during the visit",
  speed: "the service speed was noticeable",
  variety: "the product variety stood out",
  value: "the overall value was noticeable",
};

const critical: Record<string, string> = {
  quality: "the product quality could be better",
  staff: "the staff interaction needs improvement",
  pricing: "the pricing could be better",
  availability: "some items I needed were unavailable",
  cleanliness: "cleanliness could be improved",
  speed: "the service took longer than expected",
  variety: "the product variety could be improved",
  value: "the value did not meet my expectations",
};

function polish(value: string) {
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned) return "";
  const sentence = cleaned[0].toUpperCase() + cleaned.slice(1);
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
}

function joinSentences(values: string[]) {
  if (values.length <= 1) return values[0] ?? "";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

export class LocalReviewGenerator implements ReviewGenerator {
  async generate(input: GenerateReviewInput): Promise<GenerateReviewOutput> {
    const { businessName, rating, topics, note, variation } = input;
    const opening = this.opening(businessName, rating, variation);
    const phraseMap = rating >= 4 ? positive : rating <= 2 ? critical : mixed;
    const details = topics.map((topic) => phraseMap[topic.id] ?? topic.label.toLowerCase());
    const closing = this.closing(rating, variation);

    const sentences = [opening];
    if (details.length) sentences.push(`${joinSentences(details)}.`);
    if (note?.trim()) sentences.push(polish(note));
    sentences.push(closing);

    return {
      text: sentences.filter(Boolean).join(" "),
      provider: "local-template-v1",
    };
  }

  private opening(businessName: string, rating: number, variation: number) {
    const alternates = {
      1: [`I had a disappointing experience at ${businessName}.`, `Unfortunately, my visit to ${businessName} did not go well.`],
      2: [`My experience at ${businessName} was below expectations.`, `There were a few issues during my visit to ${businessName}.`],
      3: [`My experience at ${businessName} was mixed overall.`, `There were both good and not-so-good parts to my visit to ${businessName}.`],
      4: [`I had a good experience at ${businessName}.`, `Overall, I enjoyed my visit to ${businessName}.`],
      5: [`I had a great experience at ${businessName}.`, `Really enjoyed my visit to ${businessName}.`],
    } as const;
    return alternates[rating as keyof typeof alternates][variation % 2];
  }

  private closing(rating: number, variation: number) {
    if (rating >= 4) return variation % 2 ? "Would happily visit again." : "Overall, it was a pleasant experience.";
    if (rating === 3) return variation % 2 ? "There is room for improvement." : "Overall, it was an average experience.";
    return variation % 2 ? "I hope the team can improve these areas." : "I hope these issues can be improved.";
  }
}
