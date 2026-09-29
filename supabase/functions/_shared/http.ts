import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2";

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// Client acting as the caller (RLS applies).
export function userClient(req: Request): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
}

// Service-role client. Only for tables with no RLS policies (tokens) or server-only writes (event log).
export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

export async function requireUser(req: Request): Promise<{ user: User; db: SupabaseClient } | Response> {
  const db = userClient(req);
  const { data: { user } } = await db.auth.getUser();
  return user ? { user, db } : json({ error: "unauthorized" }, 401);
}

export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? body : null;
  } catch {
    return null;
  }
}
