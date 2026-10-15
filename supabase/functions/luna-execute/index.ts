// Runs ONLY after the user explicitly confirms in the app.
// Executes the args stored server-side when the proposal was made (what Nanda was shown),
// never args sent by the client. State moves through the work-item lifecycle
// (stage-2/docs/STATE_OWNERSHIP.md): proposed -> approved -> dispatched -> completed | failed.
import { checkCalendarOutcome } from "../_shared/calendar/acceptance.ts";
import { validateEventArgs } from "../_shared/calendar/validate.ts";
import { config } from "../_shared/config.ts";
import { createCalendarEvent, GoogleReauthRequired, refreshAccessToken } from "../_shared/calendar/googleCalendarClient.ts";
import { adminClient, json, readJson, requireUser } from "../_shared/http.ts";
import { applyEvent, loadWorkItem } from "../_shared/state/store.ts";
import { effectiveStatus, isDispatchStale, type WorkItemEvent } from "../_shared/state/workItem.ts";
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

  const admin = adminClient();
  let item = await loadWorkItem(admin, confirmationId, user.id);
  if (!item) return json({ ok: false, error: "not_found" } satisfies ExecuteResult, 404);

  // Proposal TTL: an old confirm card can no longer be executed.
  if (effectiveStatus(item, new Date()) === "expired") {
    if (item.status === "proposed") await applyEvent(admin, item, { type: "expire" });
    return json({ ok: false, error: "expired" } satisfies ExecuteResult, 410);
  }
  // Already done: replay the stored outcome instead of executing again.
  if (item.status === "completed") {
    const { retryable: _r, detail: _d, ...stored } = item.last_result ?? {};
    return json(stored as ExecuteResult);
  }
  if (item.status === "dispatched") {
    // Still within the longest possible execution: genuinely in progress.
    if (!isDispatchStale(item, new Date(), config.dispatchTimeoutSeconds * 1000)) {
      return json({ ok: false, error: "in_progress" } satisfies ExecuteResult, 409);
    }
    // Older than any execution can run: the previous run died. Mark it failed (retryable) and
    // fall through to a retry with the same id, which cannot duplicate the action (OI-1, ADR-018).
    const t = await applyEvent(admin, item, { type: "timeout" }, {
      lastResult: { ok: false, error: "timeout", retryable: true, detail: `dispatched at ${item.updated_at}, no result` },
      note: "dispatch timeout",
    });
    if (!t.ok) return json({ ok: false, error: "in_progress", details: [t.error] } satisfies ExecuteResult, 409);
    item = t.item;
  }

  // Defense in depth: stored args were validated at proposal time; check again.
  const v = validateEventArgs(item.args);
  if (!v.ok) return json({ ok: false, error: "invalid_args", details: v.errors } satisfies ExecuteResult, 500);
  const args = v.args;

  const { data: tokenRow, error: tokenErr } = await admin.from("user_google_tokens")
    .select("refresh_token").eq("user_id", user.id).maybeSingle();
  if (tokenErr) {
    console.error(tokenErr);
    return json({ ok: false, error: "calendar_error" } satisfies ExecuteResult, 500);
  }
  // Checked before any transition, so the proposal stays confirmable after connecting Google.
  if (!tokenRow) return json({ ok: false, error: "google_not_connected" } satisfies ExecuteResult, 409);

  // Move to "dispatched": approve + dispatch, re-dispatch an approved item, or retry a retryable failure.
  const steps: WorkItemEvent[] = item.status === "proposed" || item.status === "needs_approval"
    ? [{ type: "approve" }, { type: "dispatch" }]
    : item.status === "approved" ? [{ type: "dispatch" }]
    : item.status === "failed" ? [{ type: "retry" }]
    : [];
  if (!steps.length) return json({ ok: false, error: "not_executable", details: [item.status] } satisfies ExecuteResult, 409);
  for (const step of steps) {
    const r = await applyEvent(admin, item, step);
    if (!r.ok) {
      const error = r.error === "conflict" ? "in_progress" : "not_executable";
      return json({ ok: false, error, details: [r.error] } satisfies ExecuteResult, 409);
    }
    item = r.item;
  }

  let result: ExecuteResult;
  let status = 200;
  let alreadyExisted = false;
  let errorDetail: string | undefined; // full engine error, kept server-side for debugging
  try {
    const accessToken = await refreshAccessToken(tokenRow.refresh_token);
    // Google event id = work item id: a repeated insert returns the existing event.
    const event = await createCalendarEvent(accessToken, item.id, args);
    alreadyExisted = !event.created;
    // LUNA accepts the outcome only if the event matches what Nanda approved (ADR-017, OI-2).
    const mismatches = checkCalendarOutcome(args, event);
    if (mismatches.length) {
      console.error("acceptance failed", item.id, mismatches);
      result = { ok: false, error: "acceptance_failed", details: mismatches, event_id: event.id, html_link: event.htmlLink };
      status = 502;
    } else {
      result = { ok: true, event_id: event.id, html_link: event.htmlLink };
    }
  } catch (e) {
    console.error(e);
    errorDetail = String(e).slice(0, 1000);
    result = e instanceof GoogleReauthRequired
      ? { ok: false, error: "google_reauth_required" }
      : { ok: false, error: "calendar_error" };
    status = e instanceof GoogleReauthRequired ? 409 : 502;
  }

  // Google errors can succeed later (reconnect, transient). A wrong event cannot be fixed by retrying:
  // the same id would return the same event.
  const retryable = !result.ok && result.error !== "acceptance_failed";
  const recorded = await applyEvent(
    admin,
    item,
    { type: "result", status: result.ok ? "completed" : "failed", attempt: item.attempt, retryable },
    { lastResult: { ...result, retryable, ...(errorDetail ? { detail: errorDetail } : {}) } },
  );
  if (!recorded.ok) console.error("could not record result", recorded.error, item.id);

  // Keep the conversation aware of the outcome if the user continues talking.
  if (item.session_id && !alreadyExisted) {
    const content = result.ok ? `Event created: ${args.title}` : `Event creation failed: ${result.error}`;
    const { error } = await db.from("conversation_turns").insert({ session_id: item.session_id, role: "assistant", content });
    if (error) console.error("failed to store turn", error);
  }

  return json(result, status);
});
