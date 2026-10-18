# Stage 2 Plan

## Goal
Define and validate shared operational state and the context boundary needed for Luna to delegate reliably to Jarvis.

## Workstream 1 — Shared State
Questions:
- What is the canonical unit of work: mission, task, execution, or a combination?
- What state must persist vs. remain transient?
- What statuses and transitions are needed?
- Who can create/update/close state?
- How are errors, blockers, retries, duplicate requests, and late results represented?
- How do results correlate to requests?

Acceptance:
- Minimal state model documented.
- Ownership and permitted transitions clear.
- Invalid/conflicting transitions have defined behavior.
- Stage 1 contracts reused where reasonable.

## Workstream 2 — Context Projection
Questions:
- What context does Luna hold, and what subset is needed for each execution?
- How are goals, constraints, instructions, references, and success criteria represented?
- What happens when required context is missing or contradictory?
- What sensitive or irrelevant context should not be forwarded by default?

Acceptance:
- Task-context schema/mapping documented.
- Required vs. optional context identified.
- Context minimization and failure behavior described.
- Valid projection and missing-context examples included.

## Workstream 3 — Agent and Tool Ownership
Questions:
- Which layer owns planning, tool selection, retries, verification, and reporting?
- What does Luna decide vs. what may Jarvis decide locally?
- Which capabilities are exposed through the stable interface?
- What assumptions need checking against Jarvis source?

Acceptance:
- Responsibilities mapped to Luna, interface, and Jarvis.
- Ambiguous ownership documented.
- No dependency on undocumented Jarvis internals introduced.

## Order
1. Verify Stage 1 and current architecture.
2. Draft the three design areas.
3. Review with Nanda.
4. Agree on a minimal implementation slice.
5. Implement and test it.
6. Update this plan and `STAGE_2_PROGRESS.md`.

## Out of scope
Production integration, hosting choice, fork/upstream choice, model fallback, full memory/persona redesign, full permissions/risk framework, scheduler, UI, and final architecture redesign.

## Checklist
- [x] Stage 1 artifacts inspected (2026-10-14, see docs/ARCHITECTURE_NOTES.md)
- [x] Shared State design reviewed (2026-10-15, DEC-003)
- [x] Context Projection design reviewed and implemented (2026-10-15, DEC-005 option A)
- [x] Ownership boundaries reviewed (2026-10-15, DEC-006)
- [x] Nanda-approved implementation slice recorded (Workstream 1: DEC-003 option B)
- [x] Tests added/updated and run (62 passed, 0 failed on 2026-10-15)
- [x] Progress and decision log updated
