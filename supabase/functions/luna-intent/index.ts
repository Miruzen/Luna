import { createClient } from "npm:@supabase/supabase-js@2";
import { config } from "../_shared/config.ts";
import { createProvider } from "../_shared/llm/factory.ts";
import { validateEventArgs } from "../_shared/calendar/validate.ts";
import type { IntentResult } from "../_shared/types.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  // Identify the caller from their Supabase JWT.
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  const { text } = await req.json();
  if (typeof text !== "string" || !text.trim()) return json({ error: "text is required" }, 400);

  try {
    // TODO: load recent conversation_turns for this session as `history`.
    const result = await createProvider().extractCalendarIntent({
      userText: text,
      nowISO: new Date().toISOString(),
      timezone: config.defaultTimezone,
      history: [],
    });

    let out: IntentResult;
    if (result.kind === "tool_call") {
      const v = validateEventArgs(result.args);
      out = v.ok
        ? { kind: "confirm", args: v.args, summary: `${v.args.title} — ${v.args.start_datetime} to ${v.args.end_datetime}` }
        : { kind: "clarification", question: "I couldn't lock down the details. Can you repeat the event with date, time and duration?" };
      if (!v.ok) console.error("validation failed", v.errors);
    } else {
      out = { kind: "clarification", question: result.text || "Could you say that again?" };
    }
    return json(out);
  } catch (e) {
    console.error(e);
    return json({ error: "intent extraction failed" }, 500);
  }
});
