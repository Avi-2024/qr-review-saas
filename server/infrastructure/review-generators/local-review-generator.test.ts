import { describe, expect, it } from "vitest";
import { LocalReviewGenerator } from "@/server/infrastructure/review-generators/local-review-generator";

describe("LocalReviewGenerator", () => {
  it("keeps topic chips neutral and preserves the customer's note", async () => {
    const generator = new LocalReviewGenerator();

    const result = await generator.generate({
      businessName: "Example Clinic",
      rating: 5,
      topics: [
        { id: "staff", label: "Staff / Support", icon: "", sortOrder: 10 },
        { id: "speed", label: "Speed / Timeliness", icon: "", sortOrder: 20 },
      ],
      note: "the team was helpful but I had to wait longer than expected",
      variation: 0,
    });

    expect(result.text).toContain("staff / support");
    expect(result.text).toContain("speed / timeliness");
    expect(result.text).toContain("The team was helpful but I had to wait longer than expected.");
    expect(result.text.toLowerCase()).not.toContain("helpful and polite");
    expect(result.text.toLowerCase()).not.toContain("reasonable");
  });

  it("uses the sector when deciding neutral language without inventing details", async () => {
    const generator = new LocalReviewGenerator();
    const sectors = [
      ["restaurant-cafe", "at"], ["salon-beauty", "at"],
      ["hospitality", "at"], ["fitness", "at"], ["retail", "at"],
      ["education", "at"], ["healthcare", "with"],
      ["automotive", "with"], ["real-estate", "with"],
      ["professional-services", "with"], ["other", "with"],
      ["invalid-sector", "with"],
    ] as const;

    for (const [businessType, preposition] of sectors) {
      for (const rating of [1, 2, 3, 4, 5] as const) {
        const result = await generator.generate({
          businessName: "Sample Company", businessType, rating,
          topics: [], variation: 0,
        });
        expect(result.text).toContain(`experience ${preposition} Sample Company`);
        expect(result.text).not.toMatch(/food|staff|doctor|treatment|clean|fast|delicious|price|recommend/i);
      }
    }
  });

  it("does not assume the customer physically visited a store", async () => {
    const generator = new LocalReviewGenerator();

    const result = await generator.generate({
      businessName: "Northstar Services",
      rating: 4,
      topics: [{ id: "quality", label: "Overall Quality", icon: "", sortOrder: 10 }],
      variation: 1,
    });

    expect(result.text).toContain("experience with Northstar Services");
    expect(result.text.toLowerCase()).not.toContain("visit to");
    expect(result.text.toLowerCase()).not.toContain("store");
  });

  it("weaves merchant product and service SEO keywords into positive reviews", async () => {
    const generator = new LocalReviewGenerator();

    const result = await generator.generate({
      businessName: "Glow Salon",
      businessType: "salon-beauty",
      rating: 5,
      topics: [],
      keywords: ["Keratin Treatment", "Hydra Facial", "Bridal Makeup"],
      variation: 0,
    });

    expect(result.text).toContain("Glow Salon");
    expect(result.text).toMatch(/Keratin Treatment|Hydra Facial/);
  });
});
