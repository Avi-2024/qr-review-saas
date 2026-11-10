import type { GenerateReviewInput, GenerateReviewOutput, ReviewGenerator } from "@/server/application/ports/review-generator";

export class GrokReviewGenerator implements ReviewGenerator {
  private readonly apiKey: string;
  private readonly fallback: ReviewGenerator;
  private readonly model: string;

  constructor(
    apiKey: string,
    fallback: ReviewGenerator,
    model: string = "openai/gpt-oss-120b",
  ) {
    this.apiKey = apiKey;
    this.fallback = fallback;
    this.model = model;
  }

  async generate(input: GenerateReviewInput): Promise<GenerateReviewOutput> {
    const trimmedKey = this.apiKey.trim();
    if (!trimmedKey) {
      return this.fallback.generate(input);
    }

    try {
      const isGroq = trimmedKey.startsWith("gsk_");
      const endpoint = isGroq
        ? "https://api.groq.com/openai/v1/chat/completions"
        : "https://api.x.ai/v1/chat/completions";

      const modelsToTry = isGroq
        ? [this.model, "openai/gpt-oss-120b", "qwen/qwen3.8-27b", "openai/gpt-oss-20b"]
        : [this.model, "grok-2-latest", "grok-beta"];

      // Deduplicate model list
      const uniqueModels = Array.from(new Set(modelsToTry));

      const shouldIncludeKeyword = (Math.abs(input.variation) % 10) < 7;
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

      for (const activeModel of uniqueModels) {
        try {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${trimmedKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: activeModel,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
              ],
              temperature: 0.85,
              max_tokens: 160,
              stream: false,
            }),
            signal: AbortSignal.timeout(4500),
          });

          if (!response.ok) {
            const errorText = await response.text().catch(() => "");
            console.warn(`[GrokReviewGenerator] ${isGroq ? "Groq" : "xAI"} model ${activeModel} status ${response.status}: ${errorText}`);
            continue;
          }

          const data = (await response.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
          };

          const rawContent = data.choices?.[0]?.message?.content?.trim();
          if (!rawContent) continue;

          // Clean up stray surrounding quotes if model added them
          const cleaned = rawContent.replace(/^["'“”]+|["'“”]+$/g, "").trim();
          if (cleaned.length < 20) continue;

          return {
            text: cleaned,
            provider: isGroq ? `groq-${activeModel}` : `grok-${activeModel}`,
          };
        } catch (callErr) {
          console.warn(`[GrokReviewGenerator] Call failed for model ${activeModel}:`, callErr);
        }
      }

      console.warn("[GrokReviewGenerator] All AI models failed, using local fallback");
      return this.fallback.generate(input);
    } catch (err) {
      console.warn("[GrokReviewGenerator] Error in generate, falling back to local engine:", err);
      return this.fallback.generate(input);
    }
  }
}
