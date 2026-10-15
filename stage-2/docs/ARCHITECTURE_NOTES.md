# Architecture Notes

Keep verified facts, proposals, and assumptions separate.

## Current state — verified (2026-10-14, commit `ea89ebd`)
- **Stage 1 artifacts found:**
  - Architecture map: `docs/architecture/CURRENT_LUNA_ARCHITECTURE.md`
  - Target architecture: `docs/architecture/ARCHITECTURE.md`
  - Jarvis recon: `docs/architecture/JARVIS_REPOSITORY_RECON_STAGE_1.md` (OpenJarvis @ `c14f579`)
  - Project-wide decision log: `docs/DECISIONS.md` (ADR-001…016, D-01…D-04)
  - Stage 1 instructions and closure: `STAGE_1/CLAUDE_STAGE_1.md`
- **Existing contracts** (`supabase/functions/_shared/execution/contract.ts`):
  - `ExecutionRequest`: `contract_version`, `request_id`, `objective`, `context: ContextItem[] {kind, content}`, `constraints: string[]`, `expected_output {description}`, `permissions: Permission[] {capability, outward}`, `approval {approved_by:"nanda", approved_at, confirmation_id} | null`, `operational_state {attempt, session_id?}`.
  - `ExecutionResult`: `status` ∈ `completed | failed | needs_approval | needs_input | rejected`, plus `result`, `evidence[]`, `actions_taken[]`, `artifacts[]`, `errors[] {code, message, retryable}`, `next_recommendation`.
  - Validators: `validateExecutionRequest` (outward permission requires Nanda's approval) and `validateExecutionResult` (`request_id` must match; `failed` needs errors).
  - Interface: `ExecutionEngine.execute()` + `delegate()` (never throws), in `interface.ts`.
- **Existing persistence/state mechanisms** (Postgres, `supabase/migrations/20260928000000_init.sql`):
  - `conversation_sessions`, `conversation_turns`: short conversation context (last 10 turns), RLS per user.
  - `calendar_events_log`: executed actions. Its `status` check allows `pending_confirmation | confirmed | failed`, but code only writes `confirmed | failed`. **(Dropped 2026-10-15, DEC-004; replaced by `work_items`/`work_item_events`.)**
  - `user_google_tokens`: service-role only.
  - **No table stores ExecutionRequests/Results or any work-item state.** *(Superseded 2026-10-15: `work_items` + `work_item_events` now exist, see `docs/STATE_OWNERSHIP.md`.)* `delegate()` is not wired into any Edge Function. The live calendar flow bypasses the execution contract.
  - Idempotency today: `confirmation_id` (from `luna-intent`) is reused as the Google event id; a retry returns the existing event without new log rows (verified live).
- **Existing Jarvis integration points:**
  - Only `supabase/functions/_shared/execution/jarvis/` (adapter + `JarvisTransport` interface).
  - **No network transport**; tests use a mock that mirrors `Jarvis.ask_full()` output.
  - No Jarvis code in the repo yet (ADR-014 subtree not added).
- **Tests executed and results:**
  - `deno test` in `supabase/functions`: **39 passed, 0 failed** (run 2026-10-14).
  - `deno check` on all 3 Edge Functions: 0 errors.
  - Live end-to-end (2026-10-14): intent → confirm → real Google Calendar event → idempotent retry, all verified.

## Proposed target
Working hypothesis to validate:
- Luna owns user intent, personal/strategic context, priorities, and delegation.
- A stable execution interface separates Luna from Jarvis internals.
- Shared operational state makes delegated work and outcomes trackable.
- Context Projection sends only task-relevant information.

## Gaps and risks
For each gap, record evidence/file, impact, and smallest next step.

## Assumptions to validate
- Stage 1 contracts can correlate state with requests/results.
- Shared State can start with the smallest persistence approach already in the repository.
- Jarvis capabilities match the proposed responsibility split.
- Context can be projected without exposing unrelated personal context.

Do not describe uninspected behavior as existing functionality or claim tests passed without running them.
