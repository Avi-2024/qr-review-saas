import type { GenerateReviewInput, GenerateReviewOutput, ReviewGenerator } from "@/server/application/ports/review-generator";

export class GrokReviewGenerator implements ReviewGenerator {
  constructor(
    private readonly apiKey: string,
    private readonly fallback: ReviewGenerator,
    private readonly model: string = "grok-2-latest",
  ) {}

  async generate(input: GenerateReviewInput): Promise<GenerateReviewOutput> {
    try {
      const shouldIncludeKeyword = (Math.abs(input.variation) % 10) < 7; // ~70% organic keywords, 30% general praise
      let keywordInstruction = "";
      if (input.keywords && input.keywords.length > 0 && input.rating >= 4 && shouldIncludeKeyword) {
        const kws = input.keywords;
        const idx1 = Math.abs(input.variation * 3 + 1) % kws.length;
        const idx2 = (idx1 + 1 + Math.abs(input.variation)) % kws.length;
        const selected = kws.length > 1 ? `"${kws[idx1]}" or "${kws[idx2]}"` : `"${kws[idx1]}"`;
        keywordInstruction = `5. Naturally mention 1 of these specific products or services: ${selected}. Make it sound like a genuine customer purchase or experience.`;
      } else if (input.keywords && input.keywords.length > 0) {
        keywordInstruction = "5. Focus on the overall experience, polite staff, honesty, and quality service without forcing specific product keywords.";
      }

      const systemPrompt = [
        "You are a real, genuine customer writing a short, authentic Google Maps review.",
        "Rules:",
        "1. Length: Exactly 2 to 3 sentences (35 to 60 words). Be concise, natural, and helpful.",
        "2. Tone: Friendly, conversational, human. NEVER use generic AI cliches like 'testament to', 'delighted to share', 'plethora of', 'beacon of excellence'.",
        "3. Output ONLY the raw review text. Do NOT add quotation marks, greetings, headers, or explanations.",
        `4. The customer rated the experience ${input.rating} out of 5 stars.`,
        keywordInstruction,
        input.topics && input.topics.length > 0
          ? `6. Key highlights: ${input.topics.map((t) => t.label).join(", ")}.`
          : "",
        input.note?.trim() ? `7. Customer specific note: ${input.note.trim()}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const userPrompt = `Write a ${input.rating}-star Google review for "${input.businessName}" (${input.businessType || "local business"}). Variation style #${input.variation}.`;

      // Support xAI models with fallback
      const modelsToTry = [this.model, "grok-beta", "grok-2"];
      const activeModel = modelsToTry[0];

      const response = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: activeModel,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.85,
          max_tokens: 140,
          stream: false,
        }),
        signal: AbortSignal.timeout(4500),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        console.warn(`[GrokReviewGenerator] Grok API returned status ${response.status}: ${errorText}`);
        return this.fallback.generate(input);
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const rawContent = data.choices?.[0]?.message?.content?.trim();
      if (!rawContent) {
        console.warn("[GrokReviewGenerator] Grok API returned empty response, falling back");
        return this.fallback.generate(input);
      }

      // Clean up stray surrounding quotes if model added them
      const cleaned = rawContent.replace(/^["'“”]+|["'“”]+$/g, "").trim();

      return {
        text: cleaned,
        provider: `grok-ai-${activeModel}`,
      };
    } catch (err) {
      console.warn("[GrokReviewGenerator] Grok API call failed or timed out, falling back to local engine:", err);
      return this.fallback.generate(input);
    }
  }
}
