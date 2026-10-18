# Claude Instructions — Create the Luna Stage 2 Workspace

## Goal
Stage 1 is reported complete. Prepare a clear Stage 2 workspace. Do not begin broad implementation immediately. First inspect the repository, confirm Stage 1 outputs, and propose the Stage 2 plan. Nanda and Claude will work through detailed decisions together.

## First: inspect, do not assume
1. Read root `CLAUDE.md` and relevant project instructions.
2. Inspect repository structure and existing documentation.
3. Locate and review Stage 1 outputs: architecture map, Execution Request/Result contracts, Execution Interface, mocked Jarvis adapter, and tests (or actual equivalents).
4. Run relevant tests if feasible. Report what was run; never claim tests passed unless executed.
5. Identify existing files that already cover these topics to avoid duplication.

## Create a Stage 2 folder
Follow existing naming conventions. If none exist, use `stage-2/` or the project's equivalent. Suggested files:
- `README.md` — scope and links
- `STAGE_2_PLAN.md` — work areas and acceptance criteria
- `docs/ARCHITECTURE_NOTES.md` — verified facts, proposals, gaps
- `docs/STATE_OWNERSHIP.md` — shared state and update ownership
- `docs/CONTEXT_PROJECTION.md` — task-relevant context passed to execution
- `docs/AGENT_TOOL_OWNERSHIP.md` — Luna/Jarvis responsibility boundaries
- `docs/DECISIONS.md` — decision log
- `STAGE_2_PROGRESS.md` — progress, blockers, next action
- tests in the repository's established test structure, where appropriate

This is a suggested structure, not a requirement to duplicate existing files. Prefer fewer files if that fits the repository better.

## Stage 2 scope

### A. Shared State
Define a consistent operational view of delegated work. Explore concepts such as work-item identity, status/lifecycle, progress, blockers, relevant decisions, next steps, result correlation, and errors. Do not assume each needs a new field or database table; inspect Stage 1 first.

### B. Context Projection
Define how Luna selects the minimum relevant context to send for a task. Distinguish:
- personal memory/preferences;
- strategic goals and mission intent;
- task instructions, resources, constraints, and success criteria;
- permissions/restrictions where supported.
Do not forward all personal context by default. Define behavior for missing or contradictory required context.

### C. Agent and Tool Ownership
Working model to validate against code:
- Luna: user intent, personal/strategic context, priorities, mission direction, delegation.
- Jarvis: execution-side agents, tools/MCP, retries and execution workflow, subject to inspection of actual capabilities.
- Shared interface: structured requests/results, status/error reporting, request/result correlation.

## Workflow
1. Inspect Stage 1 and current code.
2. Draft the design and identify conflicts/gaps.
3. Ask Nanda only for decisions that genuinely block progress.
4. Implement only the agreed scope.
5. Add/update tests and run them.
6. Update progress and decision documents.

## Acceptance criteria
- Shared-state model and lifecycle documented.
- Ownership and permitted state updates clear.
- Context projection boundary and minimum-context principles documented.
- Luna/Jarvis/tool responsibilities mapped, uncertainties labelled.
- Stage 1 contracts reused unless changes are justified.
- Tests or test plans cover normal flow, invalid inputs/transitions, missing context, failures, and retries/idempotency where relevant.
- Facts, assumptions, proposals, and open decisions separated.
- Progress file states the exact next action.

## Explicitly deferred
Do not decide these just to make progress:
1. Jarvis hosting: local PC vs. VPS.
2. Fork Jarvis vs. contribute upstream.
3. Model fallback if DeepSeek tool-calling proves unreliable.
4. Preserve, adapt, or disable Jarvis's existing memory/persona.

Document evidence and trade-offs. If a deferred decision blocks a task, explain why and propose the smallest reversible step.

## Out of scope for Stage 2
Do not silently expand into production Jarvis integration, model routing/fallback policy, full memory redesign, permissions/risk framework, learning/promotion, scheduler, full UI, or final architecture redesign.

## Session report
At the end of meaningful work, report:
1. What was inspected.
2. Changed file paths.
3. Tests actually run and results.
4. Verified findings vs. assumptions.
5. Decisions needed from Nanda.
6. Exact next action in one sentence.
