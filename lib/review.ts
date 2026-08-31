export type Rating = 1 | 2 | 3 | 4 | 5;

export type ReviewTopic = {
  id: string;
  label: string;
  icon: string;
};

export const TOPICS: ReviewTopic[] = [
  { id: "quality", label: "Product quality", icon: "◇" },
  { id: "staff", label: "Staff service", icon: "☺" },
  { id: "price", label: "Pricing", icon: "₹" },
  { id: "availability", label: "Availability", icon: "✓" },
  { id: "clean", label: "Cleanliness", icon: "✦" },
  { id: "speed", label: "Quick service", icon: "↗" },
  { id: "variety", label: "Good variety", icon: "▦" },
  { id: "value", label: "Overall value", icon: "◎" },
];

const positive: Record<string, string> = {
  quality: "the product quality was good",
  staff: "the staff was helpful and polite",
  price: "the pricing felt reasonable",
  availability: "the items I needed were available",
  clean: "the store felt clean and organised",
  speed: "the service was quick and smooth",
  variety: "there was a good variety of products",
  value: "the overall value felt good",
};

const mixed: Record<string, string> = {
  quality: "the product quality stood out",
  staff: "the staff experience was noticeable",
  price: "the pricing was something I noticed",
  availability: "product availability was noticeable",
  clean: "cleanliness was noticeable",
  speed: "the service speed stood out",
  variety: "the product variety stood out",
  value: "the overall value stood out",
};

const negative: Record<string, string> = {
  quality: "the product quality could be better",
  staff: "the staff service needs improvement",
  price: "the pricing could be better",
  availability: "some items I needed were unavailable",
  clean: "cleanliness could be improved",
  speed: "the service took longer than expected",
  variety: "the product variety could be improved",
  value: "the overall value did not meet my expectations",
};

const openings: Record<Rating, string[]> = {
  1: ["I had a disappointing experience at Mangal Traders.", "Unfortunately, my visit to Mangal Traders did not go well."],
  2: ["My experience at Mangal Traders was below expectations.", "There were a few things that could have been better at Mangal Traders."],
  3: ["My experience at Mangal Traders was mixed overall.", "There were both good and not-so-good parts to my visit to Mangal Traders."],
  4: ["I had a good experience at Mangal Traders.", "Really enjoyed my visit to Mangal Traders overall."],
  5: ["I had a great experience at Mangal Traders.", "Really enjoyed my visit to Mangal Traders from start to finish."],
};

const closings: Record<Rating, string[]> = {
  1: ["I hope these issues can be improved.", "I would like to see the overall experience improved."],
  2: ["There is definitely room for improvement.", "I hope the team can improve these areas."],
  3: ["With a few improvements, the experience could be much better.", "Overall, it was an average visit."],
  4: ["I would happily visit again.", "Overall, it was a pleasant experience."],
  5: ["I would definitely recommend it.", "Would happily come back again."],
};

export function polishText(value: string) {
  const clean = value.trim().replace(/\s+/g, " ");
  if (!clean) return "";
  const capitalised = clean.charAt(0).toUpperCase() + clean.slice(1);
  return /[.!?]$/.test(capitalised) ? capitalised : `${capitalised}.`;
}

function joinNatural(items: string[]) {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

export function generateReview(rating: Rating, selectedIds: string[], note: string, variation = 0) {
  const tone = rating >= 4 ? positive : rating <= 2 ? negative : mixed;
  const parts = [openings[rating][variation % openings[rating].length]];

  if (selectedIds.length) {
    const statements = selectedIds.map((id) => tone[id]).filter(Boolean);
    if (statements.length) parts.push(`${joinNatural(statements)}.`);
  }

  const cleanedNote = polishText(note);
  if (cleanedNote) parts.push(cleanedNote);

  parts.push(closings[rating][variation % closings[rating].length]);
  return parts.join(" ");
}
