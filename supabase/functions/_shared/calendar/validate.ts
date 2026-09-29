import type { CreateCalendarEventArgs } from "../types.ts";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validTimezone(tz: string): boolean {
  try { new Intl.DateTimeFormat("en", { timeZone: tz }); return true; } catch { return false; }
}

// Returns validated args or a list of problems. The backend, not the LLM, is the authority.
export function validateEventArgs(raw: any): { ok: true; args: CreateCalendarEventArgs } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const title = typeof raw?.title === "string" ? raw.title.trim() : "";
  if (!title) errors.push("title is required");

  const start = new Date(raw?.start_datetime);
  const end = new Date(raw?.end_datetime);
  if (isNaN(start.getTime())) errors.push("start_datetime is invalid");
  if (isNaN(end.getTime())) errors.push("end_datetime is invalid");
  if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end <= start) errors.push("end must be after start");

  if (typeof raw?.timezone !== "string" || !validTimezone(raw.timezone)) errors.push("timezone is invalid");

  const attendees: string[] = Array.isArray(raw?.attendees) ? raw.attendees : [];
  if (attendees.some((a) => typeof a !== "string" || !EMAIL.test(a))) errors.push("attendees must be valid emails");

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    args: {
      title,
      start_datetime: raw.start_datetime,
      end_datetime: raw.end_datetime,
      timezone: raw.timezone,
      description: typeof raw.description === "string" ? raw.description : undefined,
      attendees: attendees.length ? attendees : undefined,
    },
  };
}
