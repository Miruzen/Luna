export interface CreateCalendarEventArgs {
  title: string;
  start_datetime: string; // ISO 8601 with offset, e.g. 2026-09-29T14:00:00+07:00
  end_datetime: string;
  timezone: string;       // IANA, e.g. Asia/Jakarta
  description?: string;
  attendees?: string[];   // emails only
}

export type IntentResult =
  | { kind: "clarification"; question: string }
  | { kind: "confirm"; args: CreateCalendarEventArgs; summary: string }
  | { kind: "chat"; message: string };
