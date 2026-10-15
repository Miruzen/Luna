// Persistence for work items (service role only: LUNA's backend is the single writer).
// Every accepted transition is a compare-and-set on (status, attempt) plus an audit row.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { EVENT_ACTOR, transition, type WorkItemEvent, type WorkItemState, type WorkItemStatus } from "./workItem.ts";

export interface WorkItem extends WorkItemState {
  id: string;
  user_id: string;
  session_id: string | null;
  capability: string;
  args: Record<string, unknown>;
  summary: string | null;
  last_result: Record<string, unknown> | null;
}

type Row = Omit<WorkItem, "last_retryable">;

const fromRow = (r: Row): WorkItem => ({ ...r, last_retryable: r.last_result?.retryable === true });

export async function createProposal(
  admin: SupabaseClient,
  p: { id: string; userId: string; sessionId: string | null; capability: string; args: unknown; summary: string; ttlMinutes: number },
  now = new Date(),
): Promise<void> {
  const { error } = await admin.from("work_items").insert({
    id: p.id,
    user_id: p.userId,
    session_id: p.sessionId,
    capability: p.capability,
    status: "proposed",
    attempt: 0,
    args: p.args,
    summary: p.summary,
    expires_at: new Date(now.getTime() + p.ttlMinutes * 60_000).toISOString(),
  });
  if (error) throw error;
  await audit(admin, p.id, null, "proposed", "luna", 0, null);
}

export async function loadWorkItem(admin: SupabaseClient, id: string, userId: string): Promise<WorkItem | null> {
  const { data, error } = await admin.from("work_items").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as Row) : null;
}

export type ApplyResult =
  | { ok: true; noop: boolean; item: WorkItem }
  | { ok: false; error: "invalid_transition" | "expired" | "stale_result" | "not_retryable" | "conflict" };

export async function applyEvent(
  admin: SupabaseClient,
  item: WorkItem,
  event: WorkItemEvent,
  opts: { lastResult?: Record<string, unknown>; note?: string } = {},
  now = new Date(),
): Promise<ApplyResult> {
  const r = transition(item, event, now);
  if (!r.ok) {
    if (r.error === "stale_result") {
      await audit(admin, item.id, item.status, item.status, EVENT_ACTOR[event.type], item.attempt, `stale_result: ${JSON.stringify(event)}`);
    }
    return r;
  }
  if (r.noop) return { ok: true, noop: true, item };

  const { data, error } = await admin.from("work_items")
    .update({ status: r.status, attempt: r.attempt, last_result: opts.lastResult ?? item.last_result, updated_at: now.toISOString() })
    .eq("id", item.id).eq("status", item.status).eq("attempt", item.attempt) // compare-and-set
    .select("*").maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, error: "conflict" }; // someone else moved it first

  await audit(admin, item.id, item.status, r.status, EVENT_ACTOR[event.type], r.attempt, opts.note ?? null);
  return { ok: true, noop: false, item: fromRow(data as Row) };
}

async function audit(
  admin: SupabaseClient,
  workItemId: string,
  from: WorkItemStatus | null,
  to: WorkItemStatus,
  actor: string,
  attempt: number,
  note: string | null,
): Promise<void> {
  const { error } = await admin.from("work_item_events").insert({ work_item_id: workItemId, from_status: from, to_status: to, actor, attempt, note });
  if (error) console.error("failed to write work_item_events", error);
}
