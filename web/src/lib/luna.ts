// Calls to LUNA's Edge Functions. Shapes mirror supabase/functions/_shared/types.ts.
import { supabase } from "./supabase";
import type { ExecuteResult } from "./outcome";

export type { ExecuteResult };

export interface EventArgs {
  title: string;
  start_datetime: string;
  end_datetime: string;
  timezone: string;
  description?: string;
  attendees?: string[];
}

export type IntentResult =
  | { kind: "clarification"; session_id: string; question: string }
  | { kind: "confirm"; session_id: string; confirmation_id: string; args: EventArgs; summary: string };

// supabase.functions.invoke treats non-2xx as an error; LUNA returns useful JSON bodies on
// 4xx/5xx (e.g. "expired"), so read the body either way.
async function call<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (!error) return data as T;
  // deno-lint-ignore no-explicit-any
  const res: Response | undefined = (error as any).context;
  if (res && typeof res.json === "function") {
    try {
      return (await res.json()) as T;
    } catch { /* fall through */ }
  }
  throw new Error(error.message);
}

export const intent = (text: string, sessionId?: string) =>
  call<IntentResult | { error: string }>("luna-intent", { text, session_id: sessionId });

export const execute = (confirmationId: string) => call<ExecuteResult>("luna-execute", { confirmation_id: confirmationId });

export const cancel = (confirmationId: string) =>
  call<{ ok: boolean; status?: string; error?: string }>("luna-cancel", { confirmation_id: confirmationId });

export const exchangeGoogleCode = (code: string, redirectUri: string) =>
  call<{ connected?: boolean; error?: string }>("auth-google-exchange", { code, redirect_uri: redirectUri });
