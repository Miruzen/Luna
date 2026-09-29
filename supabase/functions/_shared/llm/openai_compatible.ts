import type { IntentInput, LLMProvider, ProviderResult } from "./provider.ts";

// OpenAI and DeepSeek both speak the OpenAI chat-completions format,
// so one class covers both. Add a separate class only if a provider differs.
export interface OpenAICompatibleConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

const TOOL = {
  type: "function",
  function: {
    name: "create_google_calendar_event",
    description: "Propose a calendar event. Only call when title, date and start time are clear.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        start_datetime: { type: "string", description: "ISO 8601 with UTC offset" },
        end_datetime: { type: "string", description: "ISO 8601 with UTC offset" },
        timezone: { type: "string", description: "IANA timezone" },
        description: { type: "string" },
        attendees: { type: "array", items: { type: "string" }, description: "Emails only. Never guess emails." },
      },
      required: ["title", "start_datetime", "end_datetime", "timezone"],
    },
  },
};

export class OpenAICompatibleProvider implements LLMProvider {
  constructor(private cfg: OpenAICompatibleConfig) {}

  async extractCalendarIntent(input: IntentInput): Promise<ProviderResult> {
    const system =
      `You are LUNA, a personal assistant. Current datetime: ${input.nowISO}. User timezone: ${input.timezone}. ` +
      `Resolve relative dates ("tomorrow", "next Monday") against the current datetime. ` +
      `If title, date or start time is missing or ambiguous, ask ONE short clarifying question instead of calling the tool. ` +
      `If duration is missing, ask (or propose 1 hour). Never invent attendee emails.`;

    const res = await fetch(`${this.cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.cfg.apiKey}` },
      body: JSON.stringify({
        model: this.cfg.model,
        messages: [{ role: "system", content: system }, ...input.history, { role: "user", content: input.userText }],
        tools: [TOOL],
      }),
    });
    if (!res.ok) throw new Error(`LLM error ${res.status}: ${await res.text()}`);

    const data = await res.json();
    const msg = data.choices?.[0]?.message;
    const call = msg?.tool_calls?.[0];
    if (call?.function?.name === "create_google_calendar_event") {
      return { kind: "tool_call", args: JSON.parse(call.function.arguments) };
    }
    return { kind: "text", text: msg?.content ?? "" };
  }
}
