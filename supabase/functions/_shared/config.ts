// LLM provider settings are read in _shared/llm/factory.ts (provider-specific code stays there).
export const config = {
  defaultTimezone: Deno.env.get("DEFAULT_TIMEZONE") ?? "Asia/Jakarta",
  googleClientId: Deno.env.get("GOOGLE_CLIENT_ID") ?? "",
  googleClientSecret: Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "",
  // Longest an Edge Function can run on the Supabase Free plan (150 s). A work item dispatched
  // longer ago than this cannot still be executing. Raise to 400 if the plan is upgraded (OI-1, OI-5).
  dispatchTimeoutSeconds: 150,
  proposalTtlMinutes: 15, // a confirm card must be confirmed within this time (Stage 2, DEC-003)
  historyTurns: 10, // recent turns sent to the LLM for clarification follow-ups
};
