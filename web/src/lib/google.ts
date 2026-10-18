// "Connect Google" from the web (replaces scripts/google-connect.ts for normal use).
// The browser only gets an auth code; the exchange happens server-side in auth-google-exchange,
// which accepts this redirect URI only if it is allowlisted (GOOGLE_ALLOWED_REDIRECT_URIS).
import { exchangeGoogleCode } from "./luna";

const SCOPE = "https://www.googleapis.com/auth/calendar.events";
const STATE_KEY = "luna.google.state";
export const CALLBACK_PATH = "/google/callback";

const redirectUri = () => `${window.location.origin}${CALLBACK_PATH}`;

export function startGoogleConnect(): void {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;
  if (!clientId) throw new Error("Missing VITE_GOOGLE_CLIENT_ID");
  const state = crypto.randomUUID();
  sessionStorage.setItem(STATE_KEY, state);
  const url = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  window.location.assign(url);
}

// Called on /google/callback. Returns a message for the user.
export async function finishGoogleConnect(): Promise<string> {
  const params = new URLSearchParams(window.location.search);
  const expected = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(STATE_KEY);
  if (params.get("error")) return `Google menolak: ${params.get("error")}`;
  const code = params.get("code");
  if (!code || !expected || params.get("state") !== expected) return "Gagal: respons Google tidak valid (state tidak cocok).";
  const res = await exchangeGoogleCode(code, redirectUri());
  return res.connected ? "✅ Google Calendar terhubung." : `Gagal menghubungkan Google: ${res.error ?? "unknown"}`;
}
