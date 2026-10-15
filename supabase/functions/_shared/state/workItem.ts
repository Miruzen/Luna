// Work-item lifecycle (Stage 2, Workstream 1). Pure logic: no I/O, no Deno APIs.
// Design and rationale: stage-2/docs/STATE_OWNERSHIP.md. LUNA's backend is the only writer;
// Nanda and execution engines only *request* transitions, validated here.
import type { ExecutionStatus } from "../execution/contract.ts";

export const WORK_ITEM_STATUSES = [
  "proposed", "approved", "dispatched", "needs_approval", "needs_input",
  "completed", "failed", "rejected", "cancelled", "expired",
] as const;
export type WorkItemStatus = typeof WORK_ITEM_STATUSES[number];

export type Actor = "nanda" | "luna" | "engine";

export interface WorkItemState {
  status: WorkItemStatus;
  attempt: number; // 0 until first dispatch; +1 on every dispatch
  expires_at: string; // ISO; only meaningful while `proposed`
  last_retryable?: boolean; // from the last failed result: may it be retried?
}

export type WorkItemEvent =
  | { type: "approve" } // Nanda confirms (also grants a missing permission from needs_approval)
  | { type: "cancel" } // Nanda declines or cancels
  | { type: "expire" } // LUNA: proposal past its TTL
  | { type: "dispatch" } // LUNA hands it to an engine (attempt + 1)
  | { type: "retry" } // LUNA re-dispatches a retryable failure (attempt + 1)
  | { type: "provide_input" } // LUNA re-dispatches with the missing input (attempt + 1)
  | { type: "result"; status: ExecutionStatus; attempt: number; retryable: boolean };

export const EVENT_ACTOR: Record<WorkItemEvent["type"], Actor> = {
  approve: "nanda",
  cancel: "nanda",
  expire: "luna",
  dispatch: "luna",
  retry: "luna",
  provide_input: "luna",
  result: "engine",
};

export type TransitionOutcome =
  | { ok: true; noop: false; status: WorkItemStatus; attempt: number; last_retryable?: boolean }
  | { ok: true; noop: true; status: WorkItemStatus; attempt: number } // duplicate request, nothing to do
  | { ok: false; error: "invalid_transition" | "expired" | "stale_result" | "not_retryable" };

const TERMINAL: ReadonlySet<WorkItemStatus> = new Set(["completed", "rejected", "cancelled", "expired"]);

export const isTerminal = (s: WorkItemState) =>
  TERMINAL.has(s.status) || (s.status === "failed" && !s.last_retryable);

// A proposal past its TTL is expired even if storage still says "proposed".
export function effectiveStatus(s: WorkItemState, now: Date): WorkItemStatus {
  return s.status === "proposed" && now.getTime() >= Date.parse(s.expires_at) ? "expired" : s.status;
}

export function transition(s: WorkItemState, e: WorkItemEvent, now: Date): TransitionOutcome {
  const status = effectiveStatus(s, now);
  const to = (next: WorkItemStatus, attempt = s.attempt, extra: { last_retryable?: boolean } = {}): TransitionOutcome =>
    ({ ok: true, noop: false, status: next, attempt, ...extra });

  switch (e.type) {
    case "approve":
      if (status === "proposed" || status === "needs_approval") return to("approved");
      if (status === "expired") return { ok: false, error: "expired" };
      // Double tap after approval: idempotent, report current state.
      if (status === "approved" || status === "dispatched" || status === "completed") {
        return { ok: true, noop: true, status, attempt: s.attempt };
      }
      return { ok: false, error: "invalid_transition" };

    case "cancel":
      return isTerminal({ ...s, status }) ? { ok: false, error: "invalid_transition" } : to("cancelled");

    case "expire":
      if (s.status === "proposed" && status === "expired") return to("expired");
      return { ok: false, error: "invalid_transition" };

    case "dispatch":
      return status === "approved" ? to("dispatched", s.attempt + 1) : { ok: false, error: "invalid_transition" };

    case "retry":
      if (status !== "failed") return { ok: false, error: "invalid_transition" };
      return s.last_retryable ? to("dispatched", s.attempt + 1) : { ok: false, error: "not_retryable" };

    case "provide_input":
      return status === "needs_input" ? to("dispatched", s.attempt + 1) : { ok: false, error: "invalid_transition" };

    case "result":
      // Only the current attempt of a dispatched item may report; anything else is late/duplicate.
      if (status !== "dispatched" || e.attempt !== s.attempt) return { ok: false, error: "stale_result" };
      return to(e.status, s.attempt, e.status === "failed" ? { last_retryable: e.retryable } : {});
  }
}
