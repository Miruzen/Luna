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
      });
    default:
      throw new Error(`Unknown LLM_PROVIDER: ${config.llmProvider}`);
  }
}
