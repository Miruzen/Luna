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
    description: "Propose a calendar event for the user to confirm. Only call when date and start time are clear.",
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
      `You are LUNA, a personal assistant that only schedules Google Calendar events. ` +
      `Current local datetime: ${input.nowLocal}. User timezone: ${input.timezone}. ` +
      `Resolve relative dates ("tomorrow", "besok", "next Monday") against the current local datetime. ` +
      `Always use timezone "${input.timezone}" and write datetimes as ISO 8601 with its UTC offset. ` +
      `If the date or start time is missing or ambiguous, ask ONE short clarifying question instead of calling the tool. ` +
      `If no title is given, derive a short one from the request. If duration is missing, use 1 hour. ` +
      `Never invent attendee emails. If the request is not about scheduling, briefly say you can only schedule events. ` +
      `Reply in the same language as the user.`;

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
      try {
        return { kind: "tool_call", args: JSON.parse(call.function.arguments) };
      } catch {
        return { kind: "tool_call", args: null }; // malformed JSON -> fails validation -> clarification
      }
    }
    return { kind: "text", text: msg?.content ?? "" };
  }
}
