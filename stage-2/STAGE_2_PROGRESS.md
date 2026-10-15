# Stage 2 Progress — Handoff for Nanda

Keep this file short and update it at the end of each meaningful session. History is at the bottom (newest first), so work can be backtracked or redone.

## Current status
**Stage 2 COMPLETED** (approved by Nanda on 2026-10-15). The five carried items are tracked in `docs/OPEN_ITEMS.md` (OI-1…OI-5) until decided.

## Last completed (2026-10-15)
- WS1 Shared State: live and verified (`3881ead`).
- WS2 Context Projection: implemented (`170fc2a`).
- WS3 Ownership: map accepted (DEC-006); F3 fixed in the adapter; ADR-017 (verification split) and ADR-018 (outward idempotency) recorded in `docs/DECISIONS.md` and root `CLAUDE.md`.
- Tests: **62 passed, 0 failed**.

## Stage 2 acceptance check (from `CLAUDE_STAGE_2_START_HERE.md`)
| Criterion | Status | Where |
|---|---|---|
| Shared-state model and lifecycle documented | Met | `docs/STATE_OWNERSHIP.md` §2 |
| Ownership and permitted state updates clear | Met | `docs/STATE_OWNERSHIP.md` §2.4 (single writer, transition table) |
| Context projection boundary and minimum-context principles documented | Met | `docs/CONTEXT_PROJECTION.md` |
| LUNA/Jarvis/tool responsibilities mapped, uncertainties labelled | Met | `docs/AGENT_TOOL_OWNERSHIP.md` §1 |
| Stage 1 contracts reused unless justified | Met | Only optional additions (`inputs`, `source`), justified in DEC-005 |
| Tests cover normal flow, invalid inputs/transitions, missing context, failures, retries/idempotency | Met | 62 unit tests + live E2E 2026-10-15 (tampered args, replay, expiry, unknown id) |
| Facts, assumptions, proposals and open decisions separated | Met | [FACT]/[PROPOSAL]/[OPEN] and verified/proposed/unresolved labels |
| Progress file states the exact next action | Met | Below |
| Out of scope respected (no production Jarvis integration, etc.) | Met | Jarvis still not pulled or connected |

## Carried forward (not Stage 2 scope)
- Timeout recovery for work items stuck in `dispatched` (`docs/STATE_OWNERSHIP.md` limitation).
- LUNA outcome acceptance check (ADR-017): to be built together with ADR-011.
- Free-model date accuracy ("lusa" misread on 2026-10-15).
- Jarvis hosting (D-01, on hold); pulling Jarvis in (ADR-014 subtree) and create-event tool (ADR-011).
- Google OAuth app in Testing mode (refresh token expires every 7 days); Supabase free tier pauses after ~7 idle days.

## Current focus
None. Waiting for Stage 3 instructions from Nanda.

## Direction
- Luna: user intent, personal/strategic context, priorities, mission direction, delegation.
- Jarvis: execution layer; exact responsibilities to be verified.
- Stage 2 extends rather than replaces Stage 1.
- Infrastructure decisions: see DEC-001. Hosting (D-01) is still on hold.

## Decisions needed from Nanda
None for Stage 2. Open items: `docs/OPEN_ITEMS.md`.

## Blockers/uncertainties
- Stuck `dispatched` items have no timeout recovery yet (known limitation, see `docs/STATE_OWNERSHIP.md`).
- Model accuracy: the free model mapped "lusa jam 9 pagi" to Fri 16 Oct 09:30 instead of Sat 17 Oct 09:00 (2026-10-15 E2E). Not a state issue, but it affects trust in confirm cards.
- Jarvis capabilities: only source-level evidence (recon @ `c14f579`); nothing runtime-tested.

## Exact next action
Nanda defines Stage 3; at its start Claude raises `docs/OPEN_ITEMS.md`.

---

## History
- **2026-10-15** — **Stage 2 closed** by Nanda. Carried items moved to the project-wide `docs/OPEN_ITEMS.md` (OI-1…OI-5) as reminders until decided; root `CLAUDE.md` now requires raising them at the start of every stage.
- **2026-10-15** — DEC-006 accepted. Slice B implemented: adapter maps Jarvis max-turns to `failed`/`engine_incomplete` (retryable) with a test; F2 idempotency rule in `contract.ts`; ADR-017/018 added to `docs/DECISIONS.md` and root `CLAUDE.md`; ADR-011 got its Stage 2 requirements. 62 tests pass. Stage 2 acceptance check written; all criteria met.
- **2026-10-15** — WS2 committed (`170fc2a`). Workstream 3 draft written: 18-row responsibility map (verified / proposed / unresolved) and 3 findings from Jarvis source: F1 no generic verification, F2 double retry layers, F3 adapter treats max-turns as completed. Logged DEC-006.
- **2026-10-15** — DEC-005 accepted after Nanda asked whether `inputs` and the projector add interpretation layers (answer: no; one AI interpretation, which Nanda checks on the confirm card; the projector is deterministic code). Implemented option A: `projection.ts`, `policies.ts`, contract `inputs?`/`source?`, adapter renders inputs as JSON. 61 tests pass. No deploy.
- **2026-10-15** — Workstream 1 committed and pushed (`3881ead`). Workstream 2 draft written (`docs/CONTEXT_PROJECTION.md`): default-deny projection policy per capability, field rules, missing/contradictory behaviour, examples, test plan. Logged DEC-005.
- **2026-10-15** — DEC-004 accepted: `calendar_events_log` dropped after a dependency check (no readers, no dependents, 3 test rows). Full error text moved to `work_items.last_result.detail`. Order: stop writing → deploy → drop. Verified live (replay and expiry still correct). 51 tests pass.
- **2026-10-15** — Workstream 1 implemented (DEC-003 option B, TTL 15 min). First migration failed in production at insert time (Postgres caps regex repetition at 255; `{5,1024}` invalid). Fixed with `20261015000100_fix_work_item_id_check.sql` after testing the expression in Postgres first. Fixed replay leaking the internal `retryable` field. E2E verified. Logged DEC-004 (calendar log). One test event created in Nanda's calendar ("TEST LUNA", Fri 16 Oct 16:00); the second proposal expired and was never executed.
- **2026-10-14** — Workstream 1 draft written (`docs/STATE_OWNERSHIP.md`). Found 2 gaps: the confirm card is not stored server-side (client-sent args are executed) and `confirmation_id` never expires. Logged DEC-003. Also (non-project): freed ~28 GB on C: for Nanda.
- **2026-10-14** — DEC-001 (keep ADR-014/015/016) and DEC-002 (Stage 2 log here, permanent ADRs in `docs/DECISIONS.md`) accepted by Nanda.
- **2026-10-14** — Stage 2 workspace received from Nanda. Verified Stage 1 (39/39 tests, live E2E done earlier the same day at commit `ea89ebd`). Logged DEC-001 and DEC-002. Root `CLAUDE.md` now points to `stage-2/`.
