import { assertEquals } from "jsr:@std/assert@1";
import { effectiveStatus, isDispatchStale, isTerminal, transition, type WorkItemEvent, type WorkItemState } from "./workItem.ts";

const NOW = new Date("2026-10-15T10:00:00+07:00");
const FUTURE = "2026-10-15T10:15:00+07:00";
const PAST = "2026-10-15T09:59:59+07:00";

const item = (over: Partial<WorkItemState> = {}): WorkItemState => ({ status: "proposed", attempt: 0, expires_at: FUTURE, ...over });

// Applies events in order, failing loudly if any is refused.
function run(start: WorkItemState, events: WorkItemEvent[]): WorkItemState {
  let s = start;
  for (const e of events) {
    const r = transition(s, e, NOW);
    if (!r.ok) throw new Error(`${e.type} refused: ${r.error}`);
    s = { ...s, status: r.status, attempt: r.attempt, ...("last_retryable" in r ? { last_retryable: r.last_retryable } : {}) };
  }
  return s;
}

const ok = (attempt: number) => ({ type: "result", status: "completed", attempt, retryable: false }) as const;

Deno.test("state: normal flow proposed -> approved -> dispatched -> completed", () => {
  const s = run(item(), [{ type: "approve" }, { type: "dispatch" }, ok(1)]);
  assertEquals([s.status, s.attempt], ["completed", 1]);
  assertEquals(isTerminal(s), true);
});

Deno.test("state: skipping approval is refused", () => {
  assertEquals(transition(item(), { type: "dispatch" }, NOW), { ok: false, error: "invalid_transition" });
});

Deno.test("state: terminal states cannot move", () => {
  for (const status of ["completed", "rejected", "cancelled", "expired"] as const) {
    assertEquals(transition(item({ status }), { type: "cancel" }, NOW).ok, false);
    assertEquals(transition(item({ status, attempt: 1 }), { type: "dispatch" }, NOW).ok, false);
  }
});

Deno.test("state: confirming after the TTL is refused as expired", () => {
  const old = item({ expires_at: PAST });
  assertEquals(effectiveStatus(old, NOW), "expired");
  assertEquals(transition(old, { type: "approve" }, NOW), { ok: false, error: "expired" });
  assertEquals(transition(old, { type: "expire" }, NOW).ok, true);
});

Deno.test("state: duplicate confirm (double tap) is an idempotent no-op", () => {
  const approved = run(item(), [{ type: "approve" }]);
  assertEquals(transition(approved, { type: "approve" }, NOW), { ok: true, noop: true, status: "approved", attempt: 0 });
  const done = run(item(), [{ type: "approve" }, { type: "dispatch" }, ok(1)]);
  assertEquals(transition(done, { type: "approve" }, NOW), { ok: true, noop: true, status: "completed", attempt: 1 });
});

Deno.test("state: retryable failure can be re-dispatched with attempt + 1", () => {
  const failed = run(item(), [{ type: "approve" }, { type: "dispatch" }, { type: "result", status: "failed", attempt: 1, retryable: true }]);
  assertEquals(isTerminal(failed), false);
  const again = run(failed, [{ type: "retry" }]);
  assertEquals([again.status, again.attempt], ["dispatched", 2]);
});

Deno.test("state: non-retryable failure is terminal and cannot be retried", () => {
  const failed = run(item(), [{ type: "approve" }, { type: "dispatch" }, { type: "result", status: "failed", attempt: 1, retryable: false }]);
  assertEquals(isTerminal(failed), true);
  assertEquals(transition(failed, { type: "retry" }, NOW), { ok: false, error: "not_retryable" });
});

Deno.test("state: late result from an old attempt is stale", () => {
  const retried = run(item(), [{ type: "approve" }, { type: "dispatch" }, { type: "result", status: "failed", attempt: 1, retryable: true }, { type: "retry" }]);
  assertEquals(transition(retried, ok(1), NOW), { ok: false, error: "stale_result" });
  assertEquals(transition(retried, ok(2), NOW).ok, true);
});

Deno.test("state: result for a non-dispatched or finished item is stale", () => {
  assertEquals(transition(item(), ok(0), NOW), { ok: false, error: "stale_result" });
  const done = run(item(), [{ type: "approve" }, { type: "dispatch" }, ok(1)]);
  assertEquals(transition(done, ok(1), NOW), { ok: false, error: "stale_result" });
});

Deno.test("state: needs_approval needs a new Nanda approval, then dispatches again", () => {
  const blocked = run(item(), [{ type: "approve" }, { type: "dispatch" }, { type: "result", status: "needs_approval", attempt: 1, retryable: false }]);
  assertEquals(transition(blocked, { type: "dispatch" }, NOW).ok, false);
  const s = run(blocked, [{ type: "approve" }, { type: "dispatch" }]);
  assertEquals([s.status, s.attempt], ["dispatched", 2]);
});

Deno.test("state: needs_input is resumed by LUNA providing input (attempt + 1)", () => {
  const blocked = run(item(), [{ type: "approve" }, { type: "dispatch" }, { type: "result", status: "needs_input", attempt: 1, retryable: false }]);
  const s = run(blocked, [{ type: "provide_input" }]);
  assertEquals([s.status, s.attempt], ["dispatched", 2]);
});

Deno.test("state: any non-terminal item can be cancelled by Nanda", () => {
  for (const status of ["proposed", "approved", "dispatched", "needs_approval", "needs_input"] as const) {
    assertEquals(transition(item({ status, attempt: 1 }), { type: "cancel" }, NOW).ok, true);
  }
});

Deno.test("state: dispatched item older than the execution limit is stale (OI-1)", () => {
  const sent = item({ status: "dispatched", attempt: 1, updated_at: "2026-10-15T09:57:00+07:00" }); // 3 min ago
  assertEquals(isDispatchStale(sent, NOW, 150_000), true);
  assertEquals(isDispatchStale({ ...sent, updated_at: "2026-10-15T09:59:00+07:00" }, NOW, 150_000), false); // 1 min ago
  assertEquals(isDispatchStale(item({ status: "approved", updated_at: "2026-10-15T09:00:00+07:00" }), NOW, 150_000), false);
});

Deno.test("state: timeout turns a stuck dispatch into a retryable failure, then retry re-dispatches", () => {
  const sent = item({ status: "dispatched", attempt: 1 });
  const failed = run(sent, [{ type: "timeout" }]);
  assertEquals([failed.status, failed.last_retryable], ["failed", true]);
  const again = run(failed, [{ type: "retry" }]);
  assertEquals([again.status, again.attempt], ["dispatched", 2]);
});

Deno.test("state: timeout is only valid for dispatched items", () => {
  assertEquals(transition(item(), { type: "timeout" }, NOW), { ok: false, error: "invalid_transition" });
});
