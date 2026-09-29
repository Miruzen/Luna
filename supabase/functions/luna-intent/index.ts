import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { config } from "../_shared/config.ts";
import { createProvider } from "../_shared/llm/factory.ts";
import type { ChatMessage } from "../_shared/llm/provider.ts";
import { validateEventArgs } from "../_shared/calendar/validate.ts";
import { json, readJson, requireUser } from "../_shared/http.ts";
import { formatRange, localNow } from "../_shared/time.ts";
import type { IntentResult } from "../_shared/types.ts";

// Reuses the caller's session if it is theirs (RLS), otherwise starts a new one.
async function resolveSession(db: SupabaseClient, userId: string, sessionId: unknown): Promise<string> {
  if (typeof sessionId === "string" && sessionId) {
    const { data } = await db.from("conversation_sessions").select("id").eq("id", sessionId).maybeSingle();
    if (data) return data.id;
  }
  const { data, error } = await db.from("conversation_sessions").insert({ user_id: userId }).select("id").single();
  if (error) throw error;
  return data.id;
}

async function loadHistory(db: SupabaseClient, sessionId: string): Promise<ChatMessage[]> {
  const { data, error } = await db.from("conversation_turns")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(config.historyTurns);
  if (error) throw error;
  return (data ?? []).reverse() as ChatMessage[];
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const { user, db } = auth;

  const body = await readJson(req);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return json({ error: "text is required" }, 400);

  try {
    const sessionId = await resolveSession(db, user.id, body?.session_id);
    const history = await loadHistory(db, sessionId);
    const tz = config.defaultTimezone;

    const result = await createProvider().extractCalendarIntent({
      userText: text,
      nowLocal: localNow(tz),
      timezone: tz,
      history,
    });

    let out: IntentResult;
    let assistantTurn: string;
    if (result.kind === "tool_call") {
      const v = validateEventArgs(result.args);
      if (v.ok) {
        const summary = `${v.args.title} — ${formatRange(v.args.start_datetime, v.args.end_datetime, v.args.timezone)}`;
        // Google event ids must be base32hex; a dash-less UUID (0-9a-f) qualifies.
        const confirmationId = crypto.randomUUID().replaceAll("-", "");
        out = { kind: "confirm", session_id: sessionId, confirmation_id: confirmationId, args: v.args, summary };
        assistantTurn = `Proposed event (awaiting user confirmation): ${JSON.stringify(v.args)}`;
      } else {
        console.error("validation failed", v.errors, result.args);
        const question = "I couldn't lock down the details. Can you repeat the event with date, time and duration?";
        out = { kind: "clarification", session_id: sessionId, question };
        assistantTurn = question;
      }
    } else {
      const question = result.text || "Could you say that again?";
      out = { kind: "clarification", session_id: sessionId, question };
      assistantTurn = question;
    }

    const { error } = await db.from("conversation_turns").insert([
      { session_id: sessionId, role: "user", content: text },
      { session_id: sessionId, role: "assistant", content: assistantTurn },
    ]);
    if (error) console.error("failed to store turns", error);

    return json(out);
  } catch (e) {
    console.error(e);
    return json({ error: "intent extraction failed" }, 500);
  }
});
