import type { CreateCalendarEventArgs } from "../types.ts";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Offset is mandatory: without it Date() would read the time as server-local (UTC).
const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
const MAX_DURATION_MS = 14 * 24 * 3600 * 1000;

function validTimezone(tz: string): boolean {
  try { new Intl.DateTimeFormat("en", { timeZone: tz }); return true; } catch { return false; }
}

function parseIso(v: unknown): Date | null {
  if (typeof v !== "string" || !ISO_WITH_OFFSET.test(v)) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

// Returns validated args or a list of problems. The backend, not the LLM, is the authority.
// deno-lint-ignore no-explicit-any
export function validateEventArgs(raw: any): { ok: true; args: CreateCalendarEventArgs } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const title = typeof raw?.title === "string" ? raw.title.trim() : "";
  if (!title) errors.push("title is required");
  if (title.length > 200) errors.push("title is too long");

  const start = parseIso(raw?.start_datetime);
  const end = parseIso(raw?.end_datetime);
  if (!start) errors.push("start_datetime must be ISO 8601 with UTC offset");
  if (!end) errors.push("end_datetime must be ISO 8601 with UTC offset");
  if (start && end && end <= start) errors.push("end must be after start");
  if (start && end && end.getTime() - start.getTime() > MAX_DURATION_MS) errors.push("event is longer than 14 days");

  if (typeof raw?.timezone !== "string" || !validTimezone(raw.timezone)) errors.push("timezone is invalid");

  const attendees: unknown[] = Array.isArray(raw?.attendees) ? raw.attendees : [];
  if (attendees.some((a) => typeof a !== "string" || !EMAIL.test(a))) errors.push("attendees must be valid emails");

  if (errors.length) return { ok: false, errors };
  const description = typeof raw.description === "string" && raw.description.trim() ? raw.description.trim() : undefined;
  return {
    ok: true,
    args: {
      title,
      start_datetime: raw.start_datetime,
      end_datetime: raw.end_datetime,
      timezone: raw.timezone,
      description,
      attendees: attendees.length ? (attendees as string[]) : undefined,
    },
  };
}
