// Receives the Google serverAuthCode from the app, exchanges it server-side with
// GOOGLE_CLIENT_SECRET, and stores the refresh_token (service role only).
// The exchange never happens on the device.
import { CALENDAR_SCOPE, exchangeAuthCode } from "../_shared/calendar/googleCalendarClient.ts";
import { adminClient, json, readJson, requireUser } from "../_shared/http.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const { user } = auth;

  const body = await readJson(req);
  const code = typeof body?.code === "string" ? body.code : "";
  if (!code) return json({ error: "code is required" }, 400);

  let tokens;
  try {
    tokens = await exchangeAuthCode(code);
  } catch (e) {
    console.error(e);
    return json({ error: "code exchange failed" }, 400);
  }
  if (!tokens.scope.split(" ").includes(CALENDAR_SCOPE)) {
    return json({ error: "calendar permission not granted" }, 403);
  }

  const admin = adminClient();
  if (!tokens.refreshToken) {
    // Google only returns a refresh token on first consent. If we already have one, we're fine.
    const { data } = await admin.from("user_google_tokens").select("user_id").eq("user_id", user.id).maybeSingle();
    return data
      ? json({ connected: true })
      : json({ error: "no refresh token; remove LUNA access at myaccount.google.com/permissions and retry" }, 409);
  }

  const { error } = await admin.from("user_google_tokens").upsert({
    user_id: user.id,
    refresh_token: tokens.refreshToken,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    console.error(error);
    return json({ error: "failed to store token" }, 500);
  }
  return json({ connected: true });
});
