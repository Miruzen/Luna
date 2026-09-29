export const config = {
  llmProvider: Deno.env.get("LLM_PROVIDER") ?? "openai",
  llmModel: Deno.env.get("LLM_MODEL") ?? "",
  defaultTimezone: Deno.env.get("DEFAULT_TIMEZONE") ?? "Asia/Jakarta",
  googleClientId: Deno.env.get("GOOGLE_CLIENT_ID") ?? "",
  googleClientSecret: Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "",
  historyTurns: 10, // recent turns sent to the LLM for clarification follow-ups
};
