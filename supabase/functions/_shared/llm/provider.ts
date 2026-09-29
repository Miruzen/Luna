export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface IntentInput {
  userText: string;
  nowLocal: string; // e.g. "2026-09-29T14:03:00+07:00 (Tuesday)"
  timezone: string;
  history: ChatMessage[];
}

// Raw provider output. Validation happens outside the provider.
export type ProviderResult =
  | { kind: "tool_call"; args: unknown }
  | { kind: "text"; text: string };

export interface LLMProvider {
  extractCalendarIntent(input: IntentInput): Promise<ProviderResult>;
}
