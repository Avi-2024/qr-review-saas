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
});
