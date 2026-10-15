# Shared State and Ownership — Workstream 1 draft

Status: **Implemented (option B) and verified live on 2026-10-15** (DEC-003). Code: `supabase/functions/_shared/state/` (`workItem.ts` = rules, `store.ts` = persistence). Migrations: `20261015000000_work_items.sql`, `20261015000100_fix_work_item_id_check.sql`. The §1 gaps are closed: `luna-execute` now runs the stored args, and proposals expire after 15 min.

Known limitation: an item stuck in `dispatched` (e.g. the function crashed mid-call) currently answers `in_progress` forever. Timeout recovery (§3) is not implemented yet.
Labels: **[FACT]** verified in code/live · **[PROPOSAL]** recommendation · **[OPEN]** needs a decision.

## 1. Current state

- [FACT] There are three IDs today:
  - `conversation_sessions.id`: the conversation;
  - `confirmation_id`: created by `luna-intent` for each confirm card and reused as the Google event id (idempotency);
  - `ExecutionRequest.request_id`: Stage 1 contract, not used in a live flow yet.
- [FACT] The confirm card is **not stored server-side**. `luna-execute` receives `confirmation_id` **and** `args` from the client and re-validates the args (`luna-execute/index.ts:18–21`). The server cannot prove the executed args equal the args Nanda approved.
- [FACT] `confirmation_id` never expires; an old confirm card can still be executed later.
- [FACT] The only execution record is `calendar_events_log` (`confirmed | failed` written; `pending_confirmation` allowed by the schema but never written). It is calendar-specific.
- [FACT] `delegate()` (Stage 1) is not wired into any Edge Function; the calendar path calls Google directly.
- [FACT] Retry of the same `confirmation_id` returns the existing event without new log rows (verified live 2026-10-14).

## 2. Proposed model

### 2.1 Unit of work: the **work item** [PROPOSAL]
- A work item is **one action LUNA proposes and may execute**, for example "create this calendar event".
- **No mission/parent level in Stage 2.** Every current action is single-shot. A `parent_id` can be added when multi-step missions exist; adding it later is non-breaking.

### 2.2 One ID across the whole lifecycle [PROPOSAL]
`work_item.id` = `confirmation_id` = `ExecutionRequest.request_id` = engine idempotency key.
- **Why:** the system already uses `confirmation_id` as the idempotency key (Google event id). Reusing it avoids a second ID and makes request/result correlation trivial.
- **Format:** 32 lowercase hex chars (dash-less UUID), already valid as a Google event id.

### 2.3 Lifecycle

```text
                 ┌──────────► cancelled   (Nanda declines)
                 │
 proposed ───────┼──────────► expired     (not confirmed within TTL)
                 │
                 ▼  Nanda confirms
              approved
                 │  LUNA delegates
                 ▼
             dispatched ──► completed | rejected | failed
                 ▲                                   │
                 │   retry (same id, attempt + 1),   │
                 └── only if error retryable ────────┘

 dispatched ──► needs_approval ──► approved (Nanda grants the extra permission) | cancelled
 dispatched ──► needs_input    ──► dispatched (LUNA adds context, attempt + 1) | cancelled
```

| Status | Meaning | Terminal? |
|---|---|---|
| `proposed` | LUNA proposed; waiting for Nanda | no |
| `approved` | Nanda confirmed; not yet sent | no |
| `dispatched` | Sent to an execution engine; waiting for a result | no |
| `needs_approval` | Engine needs a permission LUNA did not grant | no (blocked on Nanda) |
| `needs_input` | Engine needs information LUNA did not provide | no (blocked on LUNA/Nanda) |
| `completed` | Done; result and evidence recorded | yes |
| `failed` | Failed. Terminal unless an error is retryable | conditional |
| `rejected` | Engine cannot or will not do it | yes |
| `cancelled` | Nanda declined or cancelled | yes |
| `expired` | Proposal never confirmed within TTL | yes |

The five engine-facing statuses are exactly Stage 1's `ExecutionResult.status` (`completed | failed | needs_approval | needs_input | rejected`). The rest (`proposed`, `approved`, `dispatched`, `cancelled`, `expired`) are LUNA-side and never sent to an engine. **The Stage 1 contract does not change.**

### 2.4 Ownership of transitions [PROPOSAL]

**Single writer:** only LUNA's backend persists work-item state. Nanda acts through the client, and engines report through `ExecutionResult`; both are *requests* that LUNA validates before persisting.

| Transition | Who triggers | Who validates & persists | Notes |
|---|---|---|---|
| — → `proposed` | LUNA (`luna-intent`) | LUNA | Args stored server-side here |
| `proposed` → `approved` | Nanda (confirm in client) | LUNA | Executes the **stored** args, not client-sent ones |
| `proposed` → `cancelled` | Nanda | LUNA | |
| `proposed` → `expired` | LUNA (TTL check on access) | LUNA | No background job needed: checked when the item is read |
| `approved` → `dispatched` | LUNA (`delegate()`) | LUNA | |
| `dispatched` → engine status | Engine (via `ExecutionResult`) | LUNA (`validateExecutionResult` + transition check) | The engine never writes state directly |
| `failed` → `dispatched` | LUNA (retry policy) | LUNA | Only if every error is `retryable`; same id, `attempt + 1` |
| `needs_approval` → `approved` | Nanda | LUNA | New approval record |
| `needs_input` → `dispatched` | LUNA (with added context) | LUNA | `attempt + 1` |
| any non-terminal → `cancelled` | Nanda | LUNA | |

**Any transition not listed is invalid** and is refused with an error. State is not changed.

## 3. Reliability cases

| Case | Behaviour [PROPOSAL] |
|---|---|
| Duplicate confirm (double tap) | Same id. The second `proposed → approved` is a no-op that returns the current state. The engine dedupes on the id (today: Google event id). |
| Duplicate/late result for an old attempt | Accepted only if the item is `dispatched` and `result.attempt` equals the current attempt. Otherwise it is recorded in the audit trail as `stale_result` and ignored. |
| Result for a terminal item | Ignored and audited (no state change). |
| Timeout, outcome unknown | If the engine is idempotent on the id: safe to retry with the same id. If not: `failed` with error `outcome_unknown`, `retryable: false`, escalated to Nanda. |
| Retry after partial progress | Out of scope for Stage 2: today's actions are single-shot. Revisit with multi-step missions. |
| Conflicting updates (two writers) | Not possible by design (single writer). Concurrent requests use a compare-and-set on `(status, attempt)` so two requests can't both win. |
| Restart/recovery | State is in Postgres. A `dispatched` item older than its timeout is treated as "timeout, outcome unknown". |
| Old confirm card replayed | Refused once `expired` (TTL). Proposed default TTL: 15 minutes [OPEN]. |

## 4. Field mapping (candidate concepts → keep or defer)

| Concept (from the guide) | Decision [PROPOSAL] | Where |
|---|---|---|
| Stable work-item ID | Keep | `id` (= `confirmation_id`) |
| Parent mission/task | Defer | Not needed yet |
| Lifecycle status | Keep | `status` (table in §2.3) |
| Timestamps | Keep | `created_at`, `updated_at`, `expires_at` (Postgres `timestamptz`, current convention) |
| Progress summary | Defer | No long-running tasks yet |
| Blockers | Keep, derived | `needs_*` status + `last_result.errors` |
| Relevant decisions | Keep | Nanda's approval record (already in `ExecutionRequest.approval`) |
| Next action | Keep, derived | `last_result.next_recommendation` |
| Request/result correlation | Keep | Same `id` + `attempt` |
| Error/failure summary | Keep | `last_result.errors` |

## 5. Persistence options (the Stage 2 implementation slice)

| Option | What | Pros | Cons |
|---|---|---|---|
| **A. Pure state machine first** (recommended) | `_shared/state/workItem.ts`: types plus a `transition(item, event)` function that enforces §2.3/§2.4, with tests. No DB, no flow change. | Smallest, reversible, fully testable. Validates the design before touching the live flow. | The gaps in §1 (client-sent args, no expiry) stay open until option B. |
| B. A + persistence | Migration for `work_items` (current state) + `work_item_events` (append-only audit trail, useful to backtrack). Wire `luna-intent`/`luna-execute` to it. | Closes the §1 gaps; real shared state. | Touches the live flow; needs a DB migration. |
| C. Reuse `calendar_events_log` | Extend the existing table | No new table | Calendar-specific; wrong shape for other actions |

[RESOLVED, DEC-004] `calendar_events_log` was dropped on 2026-10-15; `work_items` (details, including `last_result.detail` for full error text) and `work_item_events` (transition history) are the only execution record.

## 6. Test plan (for option A)
- **Normal flow:** proposed → approved → dispatched → completed.
- **Invalid transitions:** e.g. `proposed → dispatched`, any change from a terminal state → refused, state unchanged.
- **Retry:** `failed` (retryable) → `dispatched` with `attempt + 1`; non-retryable `failed` → retry refused.
- **Stale result:** result with old attempt → ignored and audited.
- **Expiry:** confirm after TTL → refused (`expired`).
- **Duplicate confirm:** second approve is a no-op.
- **Escalation:** `needs_approval → approved` requires a new Nanda approval record; `needs_input → dispatched` increments the attempt.

## 7. Decisions needed from Nanda
1. **Implementation slice:** option A now (recommended), then B in a later step?
2. **Proposal TTL:** 15 minutes OK?
3. Agree that `calendar_events_log` stays untouched in Stage 2?
