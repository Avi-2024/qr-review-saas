import { describe, expect, it } from "vitest";
import { LocalReviewGenerator } from "@/server/infrastructure/review-generators/local-review-generator";

describe("LocalReviewGenerator", () => {
  it("keeps topic chips neutral and preserves the customer's note", async () => {
    const generator = new LocalReviewGenerator();

    const result = await generator.generate({
      businessName: "Mangal Traders",
      rating: 5,
      topics: [
        { id: "staff", label: "Staff Interaction", icon: "", sortOrder: 10 },
        { id: "pricing", label: "Pricing", icon: "", sortOrder: 20 },
      ],
      note: "prices were high but the overall visit was good",
      variation: 0,
    });

    expect(result.text).toContain("staff interaction");
    expect(result.text).toContain("pricing");
    expect(result.text).toContain("Prices were high but the overall visit was good.");
    expect(result.text.toLowerCase()).not.toContain("helpful and polite");
    expect(result.text.toLowerCase()).not.toContain("reasonable");
  });
});
