export interface CreateCalendarEventArgs {
  title: string;
  start_datetime: string; // ISO 8601 with offset, e.g. 2026-09-29T14:00:00+07:00
  end_datetime: string;
  timezone: string;       // IANA, e.g. Asia/Jakarta
  description?: string;
  attendees?: string[];   // emails only
}

// luna-intent response. session_id is always returned so the app can continue the conversation.
export type IntentResult =
  | { kind: "clarification"; session_id: string; question: string }
  | { kind: "confirm"; session_id: string; confirmation_id: string; args: CreateCalendarEventArgs; summary: string };

// luna-execute request / response.
export interface ExecuteRequest {
  confirmation_id: string; // from the confirm result; makes retries idempotent
  args: CreateCalendarEventArgs;
  session_id?: string;
}

export type ExecuteResult =
  | { ok: true; event_id: string; html_link: string }
  | { ok: false; error: "invalid_args" | "google_not_connected" | "google_reauth_required" | "calendar_error"; details?: string[] };
