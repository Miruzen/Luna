import type { LLMProvider } from "./provider.ts";
import { OpenAICompatibleProvider } from "./openai_compatible.ts";
import { FallbackProvider } from "./fallback.ts";

type Env = (key: string) => string | undefined;

const list = (v: string | undefined) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);

// Returns null when the provider is listed but not configured (no key/model), so it is
// skipped instead of breaking the chain.
function buildOne(name: string, env: Env, fetchFn?: typeof fetch): LLMProvider | null {
  switch (name) {
    case "openrouter": {
      const apiKey = env("OPENROUTER_API_KEY");
      const models = list(env("OPENROUTER_MODELS"));
      if (!apiKey || !models.length) return null;
      return new OpenAICompatibleProvider({
        name,
        baseUrl: "https://openrouter.ai/api/v1",
        apiKey,
        model: models[0],
        // OpenRouter-side fallback across models, for when one model is down or rate-limited.
        extraBody: models.length > 1 ? { models } : undefined,
        fetchFn,
      });
    }
    case "deepseek": {
      const apiKey = env("DEEPSEEK_API_KEY");
      const model = env("LLM_MODEL");
      if (!apiKey || !model) return null;
      return new OpenAICompatibleProvider({
        name,
        baseUrl: "https://api.deepseek.com",
        apiKey,
        model,
        // Thinking is on by default; with tools it requires echoing reasoning_content back
        // every turn (else 400). Intent extraction doesn't need it, and it adds latency.
        extraBody: { thinking: { type: "disabled" } },
        fetchFn,
      });
    }
    case "openai": {
      const apiKey = env("OPENAI_API_KEY");
      const model = env("LLM_MODEL");
      if (!apiKey || !model) return null;
      return new OpenAICompatibleProvider({ name, baseUrl: "https://api.openai.com/v1", apiKey, model, fetchFn });
    }
    default:
      throw new Error(`Unknown LLM provider: ${name}`);
  }
}

// LLM_PROVIDERS is an ordered fallback chain, e.g. "openrouter,deepseek" (ADR-016).
// LLM_PROVIDER (single) is still honoured for older configs.
export function buildProvider(env: Env, fetchFn?: typeof fetch): LLMProvider {
  const names = list(env("LLM_PROVIDERS"));
  if (!names.length) names.push(env("LLM_PROVIDER") ?? "deepseek");

  const providers: LLMProvider[] = [];
  for (const name of names) {
    const p = buildOne(name, env, fetchFn);
    if (p) providers.push(p);
    else console.warn(`LLM provider "${name}" skipped: missing API key or model`);
  }
  if (!providers.length) throw new Error("No LLM provider configured (check LLM_PROVIDERS and API keys)");
  return providers.length === 1 ? providers[0] : new FallbackProvider(providers);
}

export function createProvider(): LLMProvider {
  return buildProvider((key) => Deno.env.get(key));
}
