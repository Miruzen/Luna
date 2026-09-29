export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface IntentInput {
  userText: string;
  nowISO: string;
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
