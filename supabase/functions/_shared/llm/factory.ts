import { config } from "../config.ts";
import type { LLMProvider } from "./provider.ts";
import { OpenAICompatibleProvider } from "./openai_compatible.ts";

export function createProvider(): LLMProvider {
  if (!config.llmModel) throw new Error("LLM_MODEL is not set");
  switch (config.llmProvider) {
    case "openai":
      return new OpenAICompatibleProvider({
        baseUrl: "https://api.openai.com/v1",
        apiKey: Deno.env.get("OPENAI_API_KEY") ?? "",
        model: config.llmModel,
      });
    case "deepseek":
      return new OpenAICompatibleProvider({
        baseUrl: "https://api.deepseek.com",
        apiKey: Deno.env.get("DEEPSEEK_API_KEY") ?? "",
        model: config.llmModel,
        // Thinking is on by default; with tools it requires echoing reasoning_content back
        // every turn (else 400). Intent extraction doesn't need it, and it adds latency.
        extraBody: { thinking: { type: "disabled" } },
      });
    default:
      throw new Error(`Unknown LLM_PROVIDER: ${config.llmProvider}`);
  }
}
