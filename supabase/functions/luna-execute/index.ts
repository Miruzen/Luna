// Runs ONLY after the user explicitly confirms in the app.
// Never trusts the client: args are re-validated here before touching Google.
import { validateEventArgs } from "../_shared/calendar/validate.ts";
import { createCalendarEvent, GoogleReauthRequired, refreshAccessToken } from "../_shared/calendar/googleCalendarClient.ts";
import { adminClient, json, readJson, requireUser } from "../_shared/http.ts";
import type { ExecuteResult } from "../_shared/types.ts";

const CONFIRMATION_ID = /^[0-9a-v]{5,1024}$/;

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const { user, db } = auth;

  const body = await readJson(req);
  const confirmationId = typeof body?.confirmation_id === "string" ? body.confirmation_id : "";
  if (!CONFIRMATION_ID.test(confirmationId)) return json({ error: "confirmation_id is required" }, 400);

  const v = validateEventArgs(body?.args);
  if (!v.ok) return json({ ok: false, error: "invalid_args", details: v.errors } satisfies ExecuteResult, 400);
  const args = v.args;

  const admin = adminClient();
  const log = (status: "confirmed" | "failed", extra: { google_event_id?: string; error?: string }) =>
    admin.from("calendar_events_log").insert({
      user_id: user.id,
      title: args.title,
      start_datetime: args.start_datetime,
      end_datetime: args.end_datetime,
      status,
      ...extra,
    }).then(({ error }) => error && console.error("failed to write event log", error));

  const { data: tokenRow, error: tokenErr } = await admin.from("user_google_tokens")
    .select("refresh_token").eq("user_id", user.id).maybeSingle();
  if (tokenErr) {
    console.error(tokenErr);
    return json({ ok: false, error: "calendar_error" } satisfies ExecuteResult, 500);
  }
  if (!tokenRow) return json({ ok: false, error: "google_not_connected" } satisfies ExecuteResult, 409);

  let result: ExecuteResult;
  let status = 200;
  try {
    const accessToken = await refreshAccessToken(tokenRow.refresh_token);
    const event = await createCalendarEvent(accessToken, confirmationId, args);
    await log("confirmed", { google_event_id: event.id });
    result = { ok: true, event_id: event.id, html_link: event.htmlLink };
  } catch (e) {
    console.error(e);
    await log("failed", { error: String(e).slice(0, 1000) });
    if (e instanceof GoogleReauthRequired) {
      result = { ok: false, error: "google_reauth_required" };
      status = 409;
    } else {
      result = { ok: false, error: "calendar_error" };
      status = 502;
    }
  }

  // Keep the conversation aware of the outcome if the user continues talking.
  if (typeof body?.session_id === "string") {
    const content = result.ok ? `Event created: ${args.title}` : `Event creation failed: ${result.error}`;
    const { error } = await db.from("conversation_turns").insert({ session_id: body.session_id, role: "assistant", content });
    if (error) console.error("failed to store turn", error);
  }

  return json(result, status);
});
