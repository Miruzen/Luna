import type { CreateCalendarEventArgs } from "../types.ts";

// TODO(step 8): refresh access token from stored refresh_token, then POST to
// https://www.googleapis.com/calendar/v3/calendars/primary/events
export async function createCalendarEvent(_accessToken: string, _args: CreateCalendarEventArgs): Promise<{ id: string }> {
  throw new Error("not implemented");
}
