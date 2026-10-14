// Dev-only "side door" to connect a Google Calendar to a LUNA user before the Android app
// exists. It never sees the Google client secret: the code is exchanged server-side by the
// auth-google-exchange Edge Function, which only accepts allowlisted redirect URIs.
//
// Usage (from repo root):
//   LUNA_SUPABASE_URL=https://<ref>.supabase.co LUNA_PUBLISHABLE_KEY=sb_publishable_... \
//   LUNA_EMAIL=<luna user email> LUNA_PASSWORD=<password> \
//   deno run --allow-net --allow-read=supabase/functions/.env \
//     --allow-env=LUNA_SUPABASE_URL,LUNA_PUBLISHABLE_KEY,LUNA_EMAIL,LUNA_PASSWORD \
//     --allow-run=rundll32 scripts/google-connect.ts
//
// Requires: GOOGLE_CLIENT_ID in supabase/functions/.env, the redirect URI below registered on
// the Google OAuth client, and the same URI in the GOOGLE_ALLOWED_REDIRECT_URIS secret.

const PORT = 8765;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
const SCOPE = "https://www.googleapis.com/auth/calendar.events";
const TIMEOUT_MS = 5 * 60 * 1000;

function need(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

const supabaseUrl = need("LUNA_SUPABASE_URL");
const publishableKey = need("LUNA_PUBLISHABLE_KEY");
const email = need("LUNA_EMAIL");
const password = need("LUNA_PASSWORD");

const envText = await Deno.readTextFile("supabase/functions/.env");
const clientId = envText.match(/^GOOGLE_CLIENT_ID=(.+)$/m)?.[1]?.trim();
if (!clientId) throw new Error("GOOGLE_CLIENT_ID missing in supabase/functions/.env");

const state = crypto.randomUUID();
const consentUrl = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
  client_id: clientId,
  redirect_uri: REDIRECT_URI,
  response_type: "code",
  scope: SCOPE,
  access_type: "offline", // ask for a refresh token
  prompt: "consent", // always return a refresh token, even on re-connect
  state,
});

async function lunaAccessToken(): Promise<string> {
  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: publishableKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`LUNA login failed: ${data.error_description ?? data.msg ?? res.status}`);
  return data.access_token;
}

const done = Promise.withResolvers<string>();
const server = Deno.serve({ hostname: "127.0.0.1", port: PORT, onListen: () => {} }, (req) => {
  const url = new URL(req.url);
  if (url.pathname !== "/callback") return new Response("Not found", { status: 404 });
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  if (error) done.reject(new Error(`Google returned: ${error}`));
  else if (url.searchParams.get("state") !== state || !code) done.reject(new Error("state mismatch or missing code"));
  else done.resolve(code);
  return new Response("LUNA: Google response received. You can close this tab and return to the terminal.");
});

console.log("Opening Google consent in your browser. If it doesn't open, visit:\n" + consentUrl + "\n");
await new Deno.Command("rundll32", { args: ["url.dll,FileProtocolHandler", consentUrl] }).output().catch(() => {});

const timer = setTimeout(() => done.reject(new Error("timed out waiting for Google consent")), TIMEOUT_MS);
try {
  const code = await done.promise;
  const token = await lunaAccessToken();
  const res = await fetch(`${supabaseUrl}/functions/v1/auth-google-exchange`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, apikey: publishableKey, "Content-Type": "application/json" },
    body: JSON.stringify({ code, redirect_uri: REDIRECT_URI }),
  });
  console.log(`auth-google-exchange → HTTP ${res.status} ${await res.text()}`);
} catch (e) {
  console.error(`FAILED: ${e instanceof Error ? e.message : e}`);
  Deno.exitCode = 1;
} finally {
  clearTimeout(timer);
  await server.shutdown();
}
