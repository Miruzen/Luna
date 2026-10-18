// Nanda declines or cancels a proposal ("Batal" on the confirm card). Moves any non-terminal work
// item to `cancelled` through the lifecycle rules (Stage/stage-2/docs/STATE_OWNERSHIP.md). Nothing is executed.
import { adminClient, json, readJson, requireUser, withCors } from "../_shared/http.ts";
import { applyEvent, loadWorkItem } from "../_shared/state/store.ts";

const CONFIRMATION_ID = /^[0-9a-v]{5,1024}$/;

Deno.serve(withCors(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const { user, db } = auth;

  const body = await readJson(req);
  const confirmationId = typeof body?.confirmation_id === "string" ? body.confirmation_id : "";
  if (!CONFIRMATION_ID.test(confirmationId)) return json({ error: "confirmation_id is required" }, 400);

  const admin = adminClient();
  const item = await loadWorkItem(admin, confirmationId, user.id);
  if (!item) return json({ ok: false, error: "not_found" }, 404);

  const r = await applyEvent(admin, item, { type: "cancel" }, { note: "cancelled by Nanda" });
  if (!r.ok) return json({ ok: false, error: "not_cancellable", details: [r.error, item.status] }, 409);

  if (item.session_id) {
    const { error } = await db.from("conversation_turns").insert({ session_id: item.session_id, role: "assistant", content: "Proposal cancelled by the user." });
    if (error) console.error("failed to store turn", error);
  }
  return json({ ok: true, status: r.item.status });
}));
