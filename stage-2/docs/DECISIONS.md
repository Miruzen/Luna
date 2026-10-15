# Stage 2 Decision Log

## Status values
- Open — not analyzed enough.
- Proposed — recommendation awaits Nanda's agreement.
- Accepted — explicitly agreed.
- Deferred — intentionally postponed.
- Rejected — considered and not selected.

## Entry template
### DEC-XXX — [Short title]
- Status:
- Context:
- Options:
- Evidence:
- Trade-offs:
- Recommendation:
- Decision owner:
- Date:
- Consequences/follow-up:

## Entries

### DEC-001 — Reconcile this log with decisions already accepted at the end of Stage 1
- Status: **Accepted** (Nanda, 2026-10-14): option a. ADR-014/015/016 stand and are not reopened in Stage 2; hosting (D-01) stays on hold.
- Context: this file and `CLAUDE_STAGE_2_START_HERE.md` list all four infrastructure decisions as Deferred. Nanda explicitly decided three of them on 2026-10-13, recorded in the project-wide log `docs/DECISIONS.md`:
  - ADR-014: fork as a git subtree in a dedicated Jarvis folder;
  - ADR-015: Jarvis memory/persona disabled, review ~2027-01;
  - ADR-016: OpenRouter as one LLM path with provider fallback (implemented and live).
  Only hosting (D-01) is still on hold.
- Options: a) keep the ADRs as decided and mark them here as "Accepted elsewhere — not reopened in Stage 2"; b) re-open them as Deferred for Stage 2.
- Evidence: `docs/DECISIONS.md`; ADR-016 code is in `supabase/functions/_shared/llm/` and running in production.
- Recommendation: **a**. These were explicit owner decisions. Stage 2 simply does not *implement* the Jarvis-related ones (production Jarvis integration is out of Stage 2 scope).
- Decision owner: Nanda
- Date: 2026-10-14

### DEC-002 — Where decisions are recorded
- Status: **Accepted** (Nanda, 2026-10-14)
- Context: there are now two logs: `docs/DECISIONS.md` (project-wide ADRs) and this file (Stage 2).
- Recommendation: this file holds Stage 2 decisions (DEC-xxx) and links to ADRs. Any decision that changes permanent architecture is also added as an ADR in `docs/DECISIONS.md`. Nothing is recorded in two places.
- Decision owner: Nanda
- Date: 2026-10-14

### DEC-003 — Workstream 1 implementation slice, proposal TTL, calendar log
- Status: **Accepted** (Nanda, 2026-10-15): **option B** (state machine + `work_items`/`work_item_events` wired into the live flow); proposal TTL **15 min**. Calendar-log question still open (see DEC-004).
- Context: Shared State design drafted in `docs/STATE_OWNERSHIP.md` (work item, one id = `confirmation_id`, 10-status lifecycle, LUNA as single writer).
- Options: A) pure state machine + tests only (no DB, no flow change); B) A + `work_items`/`work_item_events` tables wired into the live flow; C) extend `calendar_events_log`.
- Evidence: `luna-execute` trusts client-sent args and `confirmation_id` never expires (`luna-execute/index.ts:18-21`). B closes both gaps; A does not, yet.
- Recommendation: **A now, B as the next step.** Proposal TTL 15 min. Leave `calendar_events_log` untouched in Stage 2.
- Decision owner: Nanda
- Date: 2026-10-14

### DEC-004 — Future of `calendar_events_log`
- Status: **Accepted** (Nanda, 2026-10-15): **drop the table** (option c, done the same day). Checked first: nothing read it; no table/view/trigger/function depended on it; 3 test rows. The only unique data (full error text) now goes to `work_items.last_result.detail`. Order: code stopped writing → deployed → migration `20261015000200_drop_calendar_events_log.sql`.
- Context: since DEC-003, every calendar execution is recorded twice: in `work_items` + `work_item_events` (general) and in `calendar_events_log` (calendar-only, from V0.1). Both hold title, times, Google event id, status and errors.
- Problem: two sources of truth for the same fact can drift apart (e.g. one write fails), and future code may read the wrong one. Nothing reads `calendar_events_log` today.
- Options: a) keep writing both (current, zero risk, slight duplication); b) stop writing it and keep the old rows (reversible); c) drop the table later.
- Recommendation: a) during Stage 2, then b) once nothing depends on it.
- Decision owner: Nanda
- Date: 2026-10-15

### DEC-005 — Context Projection: contract additions, slice, default exclusions
- Status: **Accepted** (Nanda, 2026-10-15) after clarifying that `inputs` carries the already-approved interpretation (one AI interpretation, not two) and that the projector is deterministic code, not AI. Add `inputs?` + `ContextItem.source?`; slice **A**; raw utterance and personal context excluded by default.
- Context: Workstream 2 draft in `docs/CONTEXT_PROJECTION.md`. Facts: no long-term memory store exists; the contract has no structured input field (validated args travel as prose); `ContextItem` has no source.
- Options: contract additions `inputs?` + `ContextItem.source?` (optional, backward compatible). Slice A (pure `projectContext` + calendar policy + tests, no live change) or B (also route the live calendar call through `delegate()` with a native engine, which conflicts with ADR-011).
- Recommendation: add both optional fields; slice **A**; raw utterance and personal context excluded by default per capability.
- Decision owner: Nanda
- Date: 2026-10-15

### DEC-006 — Agent/tool ownership map, verification owner, Workstream 3 slice
- Status: **Accepted** (Nanda, 2026-10-15): map accepted (Jarvis may revise HOW, never WHAT); outcome verification owned by LUNA; slice **B**; F1–F3 approaches agreed. Permanent rules recorded as ADR-017 (verification split) and ADR-018 (outward idempotency) in `docs/DECISIONS.md` and in root `CLAUDE.md`.
- Context: Workstream 3 draft in `docs/AGENT_TOOL_OWNERSHIP.md`, validated against LUNA code and OpenJarvis @ `c14f579`.
- Findings: F1, no generic result verification in Jarvis agents (refines Stage 1 decision 8); F2, two retry layers (Jarvis in-attempt ×3, LUNA across attempts), so outward tools must be idempotent on `request_id`; F3, the adapter maps Jarvis "max turns reached" to `completed`.
- Options: A docs only; B docs + F3 fix + test + F2 rule recorded; C B + LUNA acceptance check (F1).
- Recommendation: accept the map ("Jarvis may revise HOW, never WHAT"); outcome verification = LUNA acceptance check (done with ADR-011); slice **B**.
- Decision owner: Nanda
- Date: 2026-10-15

## Known deferred decisions
> Superseded by DEC-001 (Accepted 2026-10-14): Jarvis codebase strategy = ADR-014, memory/persona = ADR-015, model fallback = ADR-016 (all in `docs/DECISIONS.md`). Only **Jarvis hosting** below is still deferred.
### Jarvis hosting
Status: Deferred. Options: local PC vs. VPS. Reopen when availability, local-device access, security, and cost requirements are clearer.

### Jarvis codebase strategy
Status: Deferred. Options: fork vs. upstream contribution. Reopen when required changes and upstream constraints are known.

### Model fallback if DeepSeek tool-calling is unreliable
Status: Deferred. Reopen after reproducible tool-calling tests and failure evidence exist.

### Jarvis memory/persona ownership
Status: Deferred. Options: preserve, adapt, or disable parts. Reopen after actual behavior and possible conflicts with Luna are understood.
