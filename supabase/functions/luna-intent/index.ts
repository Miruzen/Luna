import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { config } from "../_shared/config.ts";
import { createProvider } from "../_shared/llm/factory.ts";
import type { ChatMessage } from "../_shared/llm/provider.ts";
import { validateEventArgs } from "../_shared/calendar/validate.ts";
import { adminClient, json, readJson, requireUser } from "../_shared/http.ts";
import { createProposal } from "../_shared/state/store.ts";
import { annotateRelativeDays, formatRange, localNow, relativeDateTable } from "../_shared/time.ts";
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

// Per-stage timings (ms), logged and returned as a Server-Timing header to find latency.
function stopwatch() {
  const marks: Record<string, number> = {};
  let last = performance.now();
  return {
    lap(name: string) {
      const now = performance.now();
      marks[name] = Math.round(now - last);
      last = now;
    },
    marks,
    header: () => Object.entries(marks).map(([k, v]) => `${k};dur=${v}`).join(", "),
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const sw = stopwatch();

  const auth = await requireUser(req);
  sw.lap("auth");
  if (auth instanceof Response) return auth;
  const { user, db } = auth;

  const body = await readJson(req);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return json({ error: "text is required" }, 400);

  try {
    const sessionId = await resolveSession(db, user.id, body?.session_id);
    sw.lap("session");
    const history = await loadHistory(db, sessionId);
    sw.lap("history");
    const tz = config.defaultTimezone;

    const result = await createProvider().extractCalendarIntent({
      // OI-3: relative-day words get their exact date from code, plus a computed date table,
      // so the (free) model looks dates up instead of counting. Turns store the original text.
      userText: annotateRelativeDays(text, tz),
      nowLocal: localNow(tz),
      timezone: tz,
      calendarHints: relativeDateTable(tz),
      history,
    });
    sw.lap("llm");

    let out: IntentResult;
    let assistantTurn: string;
    if (result.kind === "tool_call") {
      const v = validateEventArgs(result.args);
      if (v.ok) {
        const summary = `${v.args.title} — ${formatRange(v.args.start_datetime, v.args.end_datetime, v.args.timezone)}`;
        // Google event ids must be base32hex; a dash-less UUID (0-9a-f) qualifies.
        const confirmationId = crypto.randomUUID().replaceAll("-", "");
        // Store exactly what Nanda will see; luna-execute runs these args, not client-sent ones.
        await createProposal(adminClient(), {
          id: confirmationId,
          userId: user.id,
          sessionId,
          capability: "calendar.events.create",
          args: v.args,
          summary,
          ttlMinutes: config.proposalTtlMinutes,
        });
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
    sw.lap("store");

    console.log("luna-intent timings", JSON.stringify(sw.marks));
    const res = json(out);
    res.headers.set("Server-Timing", sw.header());
    return res;
  } catch (e) {
    console.error(e);
    return json({ error: "intent extraction failed" }, 500);
  }
});
