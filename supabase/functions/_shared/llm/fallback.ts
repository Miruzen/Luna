import type { IntentInput, LLMProvider, ProviderResult } from "./provider.ts";

// Tries providers in order; the first one that answers wins (ADR-016). This is what keeps
// LUNA running when one provider (e.g. OpenRouter) is down, rate-limited or out of credit.
export class FallbackProvider implements LLMProvider {
  readonly name: string;

  constructor(private providers: LLMProvider[]) {
    if (!providers.length) throw new Error("FallbackProvider needs at least one provider");
    this.name = providers.map((p) => p.name).join(">");
  }

  async extractCalendarIntent(input: IntentInput): Promise<ProviderResult> {
    const errors: string[] = [];
    for (const provider of this.providers) {
      try {
        const result = await provider.extractCalendarIntent(input);
        if (errors.length) console.warn(`LLM fallback: served by ${provider.name} after ${errors.join(" | ")}`);
        return result;
      } catch (e) {
        errors.push(`${provider.name}: ${(e instanceof Error ? e.message : String(e)).slice(0, 300)}`);
      }
    }
    throw new Error(`All LLM providers failed: ${errors.join(" | ")}`);
  }
}
