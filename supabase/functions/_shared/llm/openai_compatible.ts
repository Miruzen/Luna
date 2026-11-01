import type { IntentInput, LLMProvider, ProviderResult } from "./provider.ts";

// OpenAI, DeepSeek and OpenRouter all speak the OpenAI chat-completions format,
// so one class covers them. Add a separate class only if a provider differs.
export interface OpenAICompatibleConfig {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  extraBody?: Record<string, unknown>; // provider-specific request fields
  timeoutMs?: number; // a hung provider must fail fast so the fallback can take over
  fetchFn?: typeof fetch; // injectable for tests
}

const DEFAULT_TIMEOUT_MS = 30_000; // DEC-304: free models sometimes need 15-25 s (OI-6)

const TOOL = {
  type: "function",
  function: {
    name: "create_google_calendar_event",
    description:
      "Propose a calendar event for the user to confirm. Only call when the date is clear and either the start time is clear or the event is all-day.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        start_datetime: { type: "string", description: "ISO 8601 with UTC offset" },
        end_datetime: { type: "string", description: "ISO 8601 with UTC offset" },
        timezone: { type: "string", description: "IANA timezone" },
        all_day: {
          type: "boolean",
          description:
            "true for whole-day events (seharian, sehari penuh, all day, ulang tahun, cuti, libur). Then start_datetime = 00:00 of the first day and end_datetime = 00:00 of the day after the last day.",
        },
        description: { type: "string" },
        attendees: { type: "array", items: { type: "string" }, description: "Emails only. Never guess emails." },
      },
      required: ["title", "start_datetime", "end_datetime", "timezone"],
    },
  },
};

export class OpenAICompatibleProvider implements LLMProvider {
  readonly name: string;

  constructor(private cfg: OpenAICompatibleConfig) {
    this.name = cfg.name;
  }

  async extractCalendarIntent(input: IntentInput): Promise<ProviderResult> {
    const system =
      `You are LUNA, a personal assistant that only schedules Google Calendar events. ` +
      `Current local datetime: ${input.nowLocal}. User timezone: ${input.timezone}. ` +
      `Resolve relative dates ("tomorrow", "besok", "next Monday") against the current local datetime. ` +
      `Always use timezone "${input.timezone}" and write datetimes as ISO 8601 with its UTC offset. ` +
      `If the date or start time is missing or ambiguous, ask ONE short clarifying question instead of calling the tool. ` +
      `Dates in parentheses after the user's words were computed by LUNA (weekday, ISO date, "sudah lewat" = already passed): trust them and never recompute weekdays. ` +
      `If the user's weekday does not match that date, or the date has already passed, do not call the tool: ask ONE question that states the correct weekday and date. ` +
      `Once the user confirms or corrects a date you asked about (e.g. "iya"), use the date from your question and call the tool; do not ask about the old date again. ` +
      `Build each event only from the current request and the answers to your own questions in this conversation. ` +
      `If no title is given, derive a short one from the request. If duration is missing, use 1 hour. ` +
      `"Seharian" / "sehari penuh" / "all day" means an all-day event: set all_day true and do not ask for a time. ` +
      `Put notes the user gives ("notes", "catatan", "keterangan") in description. ` +
      `Never invent attendee emails. If the request is not about scheduling, briefly say you can only schedule events. ` +
      `Reply in the same language as the user.` +
      (input.calendarHints ? `

${input.calendarHints}` : "");

    const res = await (this.cfg.fetchFn ?? fetch)(`${this.cfg.baseUrl}/chat/completions`, {
      method: "POST",
      signal: AbortSignal.timeout(this.cfg.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.cfg.apiKey}` },
      body: JSON.stringify({
        model: this.cfg.model,
        messages: [{ role: "system", content: system }, ...input.history, { role: "user", content: input.userText }],
        tools: [TOOL],
        ...this.cfg.extraBody,
      }),
    });
    if (!res.ok) throw new Error(`${this.name} error ${res.status}: ${(await res.text()).slice(0, 300)}`);

    const data = await res.json();
    console.log(`${this.name} answered with model ${data.model ?? "?"}`); // OpenRouter may fall back to another model
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
