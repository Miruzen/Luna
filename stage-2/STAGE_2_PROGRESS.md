# Stage 2 Progress — Handoff for Nanda

Keep this file short and update it at the end of each meaningful session. History is at the bottom (newest first), so work can be backtracked or redone.

## Current status
Workstreams 1 and 2 **done**. Workstream 3 (Agent and Tool Ownership) not started.

## Last completed (2026-10-15)
- Workstream 1: shared work-item state, live and verified (commit `3881ead`).
- Workstream 2: deterministic context projector + calendar policy (default deny); contract gains optional `inputs` and `ContextItem.source`; Jarvis adapter sends `inputs` as JSON. Tests: **61 passed, 0 failed**. No deploy needed (no live behaviour changed).

## Current focus
Workstream 3 (Agent and Tool Ownership): validate the responsibility table in `docs/AGENT_TOOL_OWNERSHIP.md` against code and the Jarvis recon.

## Direction
- Luna: user intent, personal/strategic context, priorities, mission direction, delegation.
- Jarvis: execution layer; exact responsibilities to be verified.
- Stage 2 extends rather than replaces Stage 1.
- Infrastructure decisions: see DEC-001. Hosting (D-01) is still on hold.

## Decisions needed from Nanda
None right now.

## Blockers/uncertainties
- Stuck `dispatched` items have no timeout recovery yet (known limitation, see `docs/STATE_OWNERSHIP.md`).
- Model accuracy: the free model mapped "lusa jam 9 pagi" to Fri 16 Oct 09:30 instead of Sat 17 Oct 09:00 (2026-10-15 E2E). Not a state issue, but it affects trust in confirm cards.
- Jarvis capabilities: only source-level evidence (recon @ `c14f579`); nothing runtime-tested.

## Exact next action
Claude drafts Workstream 3 in `docs/AGENT_TOOL_OWNERSHIP.md` (each row marked verified / proposed / unresolved) for Nanda to review.

---

## History
- **2026-10-15** — DEC-005 accepted after Nanda asked whether `inputs` and the projector add interpretation layers (answer: no; one AI interpretation, which Nanda checks on the confirm card; the projector is deterministic code). Implemented option A: `projection.ts`, `policies.ts`, contract `inputs?`/`source?`, adapter renders inputs as JSON. 61 tests pass. No deploy.
- **2026-10-15** — Workstream 1 committed and pushed (`3881ead`). Workstream 2 draft written (`docs/CONTEXT_PROJECTION.md`): default-deny projection policy per capability, field rules, missing/contradictory behaviour, examples, test plan. Logged DEC-005.
- **2026-10-15** — DEC-004 accepted: `calendar_events_log` dropped after a dependency check (no readers, no dependents, 3 test rows). Full error text moved to `work_items.last_result.detail`. Order: stop writing → deploy → drop. Verified live (replay and expiry still correct). 51 tests pass.
- **2026-10-15** — Workstream 1 implemented (DEC-003 option B, TTL 15 min). First migration failed in production at insert time (Postgres caps regex repetition at 255; `{5,1024}` invalid). Fixed with `20261015000100_fix_work_item_id_check.sql` after testing the expression in Postgres first. Fixed replay leaking the internal `retryable` field. E2E verified. Logged DEC-004 (calendar log). One test event created in Nanda's calendar ("TEST LUNA", Fri 16 Oct 16:00); the second proposal expired and was never executed.
- **2026-10-14** — Workstream 1 draft written (`docs/STATE_OWNERSHIP.md`). Found 2 gaps: the confirm card is not stored server-side (client-sent args are executed) and `confirmation_id` never expires. Logged DEC-003. Also (non-project): freed ~28 GB on C: for Nanda.
- **2026-10-14** — DEC-001 (keep ADR-014/015/016) and DEC-002 (Stage 2 log here, permanent ADRs in `docs/DECISIONS.md`) accepted by Nanda.
- **2026-10-14** — Stage 2 workspace received from Nanda. Verified Stage 1 (39/39 tests, live E2E done earlier the same day at commit `ea89ebd`). Logged DEC-001 and DEC-002. Root `CLAUDE.md` now points to `stage-2/`.
