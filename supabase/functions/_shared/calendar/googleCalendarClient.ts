import { config } from "../config.ts";
import type { CreateCalendarEventArgs } from "../types.ts";

export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export class GoogleReauthRequired extends Error {}

// Exchanges the Android serverAuthCode for tokens. redirect_uri is empty for codes
// obtained via Google Identity Services on Android.
export async function exchangeAuthCode(code: string): Promise<{ refreshToken?: string; scope: string }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      grant_type: "authorization_code",
      redirect_uri: "",
    }),
  });
  if (!res.ok) throw new Error(`Google code exchange failed ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return { refreshToken: data.refresh_token, scope: data.scope ?? "" };
}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    // invalid_grant = revoked or expired refresh token; the user must reconnect Google.
    if (res.status === 400 && text.includes("invalid_grant")) throw new GoogleReauthRequired(text);
    throw new Error(`Google token refresh failed ${res.status}: ${text}`);
  }
  return (await res.json()).access_token;
}

// eventId must be base32hex (a-v, 0-9), 5-1024 chars. Reusing it makes retries idempotent:
// a second insert returns 409 and we fetch the existing event instead of creating a duplicate.
export async function createCalendarEvent(
  accessToken: string,
  eventId: string,
  args: CreateCalendarEventArgs,
): Promise<{ id: string; htmlLink: string }> {
  const base = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
  const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
  const sendUpdates = args.attendees?.length ? "all" : "none";

  const res = await fetch(`${base}?sendUpdates=${sendUpdates}`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      id: eventId,
      summary: args.title,
      description: args.description,
      start: { dateTime: args.start_datetime, timeZone: args.timezone },
      end: { dateTime: args.end_datetime, timeZone: args.timezone },
      attendees: args.attendees?.map((email) => ({ email })),
    }),
  });

  if (res.status === 409) {
    const existing = await fetch(`${base}/${eventId}`, { headers });
    if (existing.ok) {
      const e = await existing.json();
      return { id: e.id, htmlLink: e.htmlLink };
    }
  }
  if (res.status === 401) throw new GoogleReauthRequired(await res.text());
  if (!res.ok) throw new Error(`Google Calendar error ${res.status}: ${await res.text()}`);
  const e = await res.json();
  return { id: e.id, htmlLink: e.htmlLink };
}
