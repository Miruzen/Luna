// LUNA's outcome acceptance for calendar.events.create (ADR-017, OI-2): the event that exists
// must match what Nanda approved. Pure logic; compares instants, not string formats.
import type { CreateCalendarEventArgs } from "../types.ts";
import { localDate } from "../time.ts";

export interface CreatedEvent {
  summary?: string;
  start?: string; // ISO dateTime as returned by Google, or a date ("2031-02-27") for all-day events
  end?: string;
}

export function checkCalendarOutcome(approved: CreateCalendarEventArgs, created: CreatedEvent): string[] {
  const problems: string[] = [];
  if ((created.summary ?? "").trim() !== approved.title.trim()) {
    problems.push(`title: approved "${approved.title}", got "${created.summary ?? ""}"`);
  }
  if (approved.all_day) {
    // Approved midnights -> local dates; Google returns dates (end exclusive on both sides).
    for (const [field, want, got] of [
      ["start", localDate(approved.start_datetime, approved.timezone), created.start],
      ["end", localDate(approved.end_datetime, approved.timezone), created.end],
    ] as const) {
      if (got !== want) problems.push(`${field}: approved all-day ${want}, got ${got ?? "nothing"}`);
    }
    return problems;
  }
  for (const [field, want, got] of [
    ["start", approved.start_datetime, created.start],
    ["end", approved.end_datetime, created.end],
  ] as const) {
    if (!got || isNaN(Date.parse(got))) problems.push(`${field}: missing in created event`);
    else if (Date.parse(got) !== Date.parse(want)) problems.push(`${field}: approved ${want}, got ${got}`);
  }
  return problems;
}
