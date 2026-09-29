export const config = {
  llmProvider: Deno.env.get("LLM_PROVIDER") ?? "openai",
  llmModel: Deno.env.get("LLM_MODEL") ?? "",
  defaultTimezone: Deno.env.get("DEFAULT_TIMEZONE") ?? "Asia/Jakarta",
};
