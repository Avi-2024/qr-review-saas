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
    const { businessName, businessType, rating, topics, keywords, note, variation } = input;
    const sector = businessType && KNOWN_SECTORS.has(businessType) ? businessType : "other";
    const preposition = AT_SECTORS.has(sector) ? "at" : "with";
    const sentences: string[] = [this.opening(businessName, preposition, rating, Math.abs(variation * 7 + 3))];

    // Weave in merchant's product/service SEO keywords naturally for high ratings
    if (keywords && keywords.length > 0 && rating >= 4) {
      const idx = Math.abs(variation) % keywords.length;
      const primaryKw = keywords[idx];
      const secondaryKw = keywords.length > 1 ? keywords[(idx + 1) % keywords.length] : null;

      const keywordPhrases = [
        secondaryKw && variation % 2 === 0
          ? `Really enjoyed the ${primaryKw} and ${secondaryKw}—everything was top notch.`
          : `Really impressed with the ${primaryKw}—excellent quality and attention to detail.`,
        secondaryKw && variation % 3 === 0
          ? `Their ${primaryKw} and ${secondaryKw} are truly exceptional.`
          : `Opted for their ${primaryKw} and was completely satisfied with the quality.`,
        `The ${primaryKw} was handled professionally and exceeded expectations.`,
        secondaryKw && variation % 4 === 0
          ? `Both the ${primaryKw} and ${secondaryKw} were thoroughly impressive.`
          : `Special mention for their ${primaryKw} which was simply outstanding.`,
        `Their standard of ${primaryKw} is easily among the finest around.`,
        `Really appreciated the high level of care and skill with the ${primaryKw}.`,
        secondaryKw && variation % 5 === 0
          ? `Came in for ${primaryKw} and ${secondaryKw}, and both were handled perfectly.`
          : `If you are looking for ${primaryKw}, this is definitely the place to go.`,
        `The attention to detail on the ${primaryKw} made a noticeable difference.`,
        `Extremely satisfied with the ${primaryKw}—delivered with precision and care.`,
        `From start to finish, the ${primaryKw} was carried out seamlessly.`,
        `The quality of ${primaryKw} here is genuinely remarkable.`,
        `So glad I chose them for ${primaryKw}—could not have asked for better.`,
      ];
      sentences.push(keywordPhrases[Math.abs(variation * 13 + 5) % keywordPhrases.length]);
    }

    if (topics.length) {
      const labels = topics.map((topic) => topic.label.toLowerCase());
      sentences.push(`The main highlights were ${joinNatural(labels)}.`);
    }
    if (note?.trim()) sentences.push(polish(note));
    sentences.push(this.closing(rating, Math.abs(variation * 19 + 11)));

    return { text: sentences.filter(Boolean).join(" "), provider: "local-template-v4-sector" };
  }

  private opening(name: string, prep: string, rating: number, variation: number) {
    const subject = `${prep} ${name}`;
    const alternates: Record<number, string[]> = {
      1: [
        `My experience ${subject} was disappointing overall.`,
        `My overall experience ${subject} was below expectations.`,
        `My experience ${subject} was quite poor today.`,
        `I had a rather frustrating experience ${subject}.`,
        `Unfortunately, my experience ${subject} was not good.`,
      ],
      2: [
        `My experience ${subject} could have been better.`,
        `My overall experience ${subject} was below what I had hoped.`,
        `My experience ${subject} fell short of expectations.`,
        `Had a mixed experience ${subject} with several points to address.`,
        `My experience ${subject} left a fair amount to be desired.`,
      ],
      3: [
        `My experience ${subject} was okay overall.`,
        `My overall experience ${subject} was fairly average.`,
        `My experience ${subject} was decent, with room for improvement.`,
        `Had a moderate experience ${subject} today.`,
        `An acceptable experience ${subject}, though not particularly memorable.`,
      ],
      4: [
        `I had a very good experience ${subject}. Everything went smoothly.`,
        `My experience ${subject} was positive and well handled throughout.`,
        `My overall experience ${subject} was great from start to finish.`,
        `Really good experience ${subject} with prompt attention.`,
        `Quite pleased with the overall experience ${subject}.`,
        `Solid and dependable experience ${subject}. Very satisfied overall.`,
        `Had a pleasant and hassle-free experience ${subject}.`,
        `Everything regarding my experience ${subject} was handled neatly.`,
        `Good quality and reliable experience ${subject} from start to finish.`,
        `Definitely a positive experience ${subject}—well organized and polite.`,
      ],
      5: [
        `Had a wonderful experience ${subject}! Everything was handled with great care.`,
        `My experience ${subject} was truly excellent from start to finish.`,
        `My overall experience ${subject} was outstanding and seamless.`,
        `Really impressed with the quality and overall experience ${subject}.`,
        `Easily one of the best experiences I have had ${subject}.`,
        `Everything regarding my experience ${subject} went smoothly from beginning to end.`,
        `Extremely happy with the overall experience ${subject}.`,
        `My experience ${subject} exceeded expectations in every single way.`,
        `Top tier experience ${subject}—everything was managed professionally.`,
        `Fantastic experience ${subject}! Very welcoming and pleasant.`,
        `Very pleased with the care and attention during my experience ${subject}.`,
        `A truly positive and memorable experience ${subject}.`,
        `My experience ${subject} was top notch from start to finish.`,
        `Can easily say my experience ${subject} was second to none.`,
        `Everything was handled with genuine care and dedication during my experience ${subject}.`,
      ],
    };
    const list = alternates[rating] ?? alternates[5];
    return list[variation % list.length];
  }

  private closing(rating: number, variation: number) {
    if (rating >= 4) {
      const closings = [
        "Very pleased with the entire process.",
        "Glad to have had such a smooth experience.",
        "I was completely satisfied with the service.",
        "Would gladly return again soon.",
        "Will definitely be coming back.",
        "Keep up the stellar standard of service!",
        "Deserves full marks for consistency and care.",
        "One of the most dependable places around.",
        "Looking forward to my next visit.",
        "A truly five-star outcome in every sense.",
        "Truly worth it and highly appreciated.",
        "Genuinely satisfied with the outcome.",
      ];
      return closings[variation % closings.length];
    }
    if (rating === 3) {
      const closings = [
        "A few things could be streamlined.",
        "Fairly standard experience overall.",
        "Hope to see some minor improvements next time.",
        "A reasonable baseline with scope to do better.",
      ];
      return closings[variation % closings.length];
    }
    const closings = [
      "There is clear room for improvement.",
      "Hope management addresses the response time.",
      "I hope the overall experience improves.",
      "Quite dissatisfied with how things turned out.",
    ];
    return closings[variation % closings.length];
  }
}
