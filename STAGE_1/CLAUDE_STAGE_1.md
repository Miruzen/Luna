# LUNA — Stage 1 Engineering Instructions

## Mission
Implement the approved Stage 1 foundation for LUNA while performing factual reconnaissance of the relevant Jarvis GitHub repositories.

LUNA is the architectural center:

Nanda → LUNA → Jarvis → execution → LUNA → Nanda

LUNA must remain independent from Jarvis internals so Jarvis can later be replaced without redesigning LUNA's core.

## Locked decisions

1. LUNA is the center and owns the user relationship, identity, context and strategic intelligence.
2. LUNA owns Strategic Orchestration: WHAT and WHY.
3. LUNA delegates execution through an engine-agnostic Execution Boundary.
4. Execution requests contain, at minimum: objective, relevant context, constraints, expected output, permissions and current operational state.
5. Execution results should communicate: status, result, evidence, actions taken, artifacts, errors and next recommendation.
6. Execution Interface is the long-term compatibility boundary.
7. Jarvis is an execution layer, not the center of LUNA.
8. Jarvis owns execution planning, execution agents, agent coordination, tool/MCP use, retries, workers and execution verification.
9. LUNA owns intent, mission, desired outcome, relevant context, strategic delegation, constraints and permissions.
10. Execution agents belong to the execution layer.
11. Execution agents must not automatically receive all LUNA memory.
12. Detailed Shared State, Context Projection and Memory Architecture are future stages.

## Engineering rules

- Inspect the existing LUNA repository before modifying it.
- Preserve the current backend and working DeepSeek integration unless inspection proves a change necessary.
- Do not build speculative future architecture.
- Do not make LUNA depend directly on Jarvis-specific internals.
- Prefer interfaces, adapters, DTO/contracts and dependency inversion.
- Do not integrate Jarvis merely because documentation says a component exists.

## Jarvis reconnaissance

Inspect the actual relevant Jarvis GitHub repositories before deep integration.

For each repository, record:
- repository URL
- version/commit inspected
- license
- date inspected
- source-tree map
- execution flow
- core/runtime
- orchestration
- agents
- tools
- MCP
- memory
- model abstraction/registry
- inference engines
- scheduler
- learning/tracing
- UI/interface
- dependencies

Classify components:
KEEP / ADAPT / WRAP / REIMPLEMENT / IGNORE / INVESTIGATE

Pay special attention to license and dependency licenses.

Do NOT merge or copy Jarvis into LUNA yet unless explicitly authorized.

Create:
`docs/architecture/JARVIS_REPOSITORY_RECON_STAGE_1.md`

## Architecture decision protocol

If source inspection reveals something that conflicts with a locked decision, do not silently change architecture.

Report:
1. Finding
2. Evidence/source file
3. Impact
4. Options
5. Recommendation
6. Whether Stage 1 must change

Claude is the engineering executor, not the final architecture owner.

## Required deliverables

1. Current LUNA architecture map
2. Execution Boundary contract
3. Execution Interface abstraction
4. Jarvis Adapter boundary/skeleton
5. Tests for the above
6. Jarvis repository reconnaissance report
7. Reuse/adapt/ignore inventory
8. Unresolved architecture questions

## Deferred infrastructure decisions

Four decisions stay deferred during Stage 1 (trade-offs and evidence in `docs/DECISIONS.md`, D-01…D-04):
1. Jarvis hosting — local PC vs VPS
2. Codebase strategy — fork vs contribute upstream
3. Model fallback — if DeepSeek tool-calling proves unreliable
4. Memory/persona — preserve, adapt or disable Jarvis' own memory/persona

Rules:
- Document trade-offs and findings; make no irreversible choice and implement no assumption about them.
- Build and test the Jarvis adapter against a **mocked** Jarvis API, so no hosting, fork or model choice is needed.
- If a task is blocked by one of them, explain exactly why and propose the smallest reversible step.

Calendar: ADR-011 (Option B, add create-event to Jarvis) is accepted but deferred. Keep the existing `luna-execute` calendar path intact until it is implemented.

## Completion criteria

Stage 1 is complete only when:
- LUNA can delegate through an engine-agnostic execution interface.
- LUNA does not need to know Jarvis internals.
- A Jarvis adapter boundary exists or is cleanly designed.
- Existing functionality remains intact.
- Tests pass.
- Actual Jarvis source has been inspected.
- Jarvis components have been mapped/classified.
- Future-stage architecture has not been unnecessarily implemented.
- Architecture-changing discoveries are surfaced for review.

Build the door first. Understand the machine behind the door. Do not rebuild the machine before we know what we need.
