import type { GenerateReviewInput, GenerateReviewOutput, ReviewGenerator } from "@/server/application/ports/review-generator";

/**
 * Sector only changes broad, neutral wording. It never supplies factual claims
 * about food, staff, treatment, delivery, prices or any unobserved service.
 */
const AT_SECTORS = new Set([
  "restaurant-cafe", "salon-beauty", "hospitality",
  "fitness", "retail", "education",
]);
const KNOWN_SECTORS = new Set([
  ...AT_SECTORS, "healthcare", "professional-services",
  "automotive", "real-estate", "other",
]);

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
    const { businessName, businessType, rating, topics, note, variation } = input;
    const sector = businessType && KNOWN_SECTORS.has(businessType) ? businessType : "other";
    const preposition = AT_SECTORS.has(sector) ? "at" : "with";
    const sentences: string[] = [this.opening(businessName, preposition, rating, variation)];

    if (topics.length) {
      const labels = topics.map((topic) => topic.label.toLowerCase());
      sentences.push(`The main parts of my experience were ${joinNatural(labels)}.`);
    }
    if (note?.trim()) sentences.push(polish(note));
    sentences.push(this.closing(rating, variation));

    return { text: sentences.filter(Boolean).join(" "), provider: "local-template-v4-sector" };
  }

  private opening(name: string, prep: string, rating: number, variation: number) {
    const subject = `${prep} ${name}`;
    const alternates: Record<number, [string, string]> = {
      1: [`My overall experience ${subject} was very poor.`, `My experience ${subject} was disappointing overall.`],
      2: [`My overall experience ${subject} was below expectations.`, `My experience ${subject} could have been better.`],
      3: [`My overall experience ${subject} was average.`, `My experience ${subject} was mixed overall.`],
      4: [`My overall experience ${subject} was good.`, `My experience ${subject} was good overall.`],
      5: [`My overall experience ${subject} was excellent.`, `My experience ${subject} was very positive overall.`],
    };
    return alternates[rating][variation % 2];
  }

  private closing(rating: number, variation: number) {
    if (rating >= 4) return variation % 2 ? "Overall, I was pleased with my experience." : "Overall, I was satisfied with the experience.";
    if (rating === 3) return variation % 2 ? "There is still room for improvement." : "Overall, it was an average experience.";
    return variation % 2 ? "I hope the overall experience improves." : "There is clear room for improvement.";
  }
}
