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
    const alternates: Record<number, string[]> = {
      1: [
        `My experience ${subject} was disappointing overall.`,
        `My overall experience ${subject} was below expectations.`,
        `My experience ${subject} was quite poor today.`,
      ],
      2: [
        `My experience ${subject} could have been better.`,
        `My overall experience ${subject} was below what I had hoped.`,
        `My experience ${subject} fell short of expectations.`,
      ],
      3: [
        `My experience ${subject} was okay overall.`,
        `My overall experience ${subject} was fairly average.`,
        `My experience ${subject} was decent, with room for improvement.`,
      ],
      4: [
        `I had a very good experience ${subject}. Everything went smoothly.`,
        `My experience ${subject} was positive and well handled throughout.`,
        `My overall experience ${subject} was great from start to finish.`,
      ],
      5: [
        `Had a wonderful experience ${subject}! Everything was handled with great care.`,
        `My experience ${subject} was truly excellent from start to finish.`,
        `My overall experience ${subject} was outstanding and seamless.`,
      ],
    };
    const list = alternates[rating];
    return list[variation % list.length];
  }

  private closing(rating: number, variation: number) {
    if (rating >= 4) {
      const closings = [
        "Very pleased with the entire process.",
        "Glad to have had such a smooth experience.",
        "I was completely satisfied with the service.",
      ];
      return closings[variation % closings.length];
    }
    if (rating === 3) {
      const closings = [
        "A few things could be streamlined.",
        "Fairly standard experience overall.",
        "Hope to see some minor improvements next time.",
      ];
      return closings[variation % closings.length];
    }
    const closings = [
      "There is clear room for improvement.",
      "Hope management addresses the response time.",
      "I hope the overall experience improves.",
    ];
    return closings[variation % closings.length];
  }
}
