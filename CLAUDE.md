# LUNA — permanent project rules

These rules hold across every stage. Stage-specific work lives in `STAGE_<n>/`.

## What LUNA is
LUNA is Nanda's personal AI and the architectural center of this project.

Nanda → LUNA → execution layer (currently Jarvis) → execution → LUNA → Nanda

## Decision hierarchy (runtime)
1. **Nanda** — final authority. Approves every outward-facing action and can override anything.
2. **LUNA** — second decision maker. Decides intent, what to delegate, under which constraints and permissions, and evaluates results. It acts only within what Nanda has approved.
3. **Execution layer (Jarvis)** — makes no strategic decisions. It decides only HOW to carry out a delegated task, within the permissions LUNA passes in. LUNA's approval *is* its authorization: it does not ask again (ADR-013).

Lower layers never widen their own authority. If a decision isn't clearly theirs, it escalates up: Jarvis → LUNA → Nanda.
(For building this project, Nanda is also the architecture owner; Claude is the engineering executor — see Workflow.)

## Architectural boundaries
- **LUNA owns WHO / WHY / WHAT:** identity, user relationship, intent, context, mission, desired outcome, delegation, constraints, permissions, strategic evaluation.
- **The execution layer owns HOW:** execution planning, execution agents, agent coordination, tool/MCP use, retries, workers, execution verification.
- LUNA delegates only through the engine-agnostic **Execution Interface**. LUNA core never depends on Jarvis-specific internals; anything Jarvis-specific lives in the Jarvis adapter.
- Invariant: if Jarvis is removed tomorrow, LUNA's strategic core stays intact. Only the implementation behind the Execution Interface is replaced.
- Execution agents never automatically receive all LUNA memory.
- LUNA core does not build its own multi-agent system. Agents belong to the execution layer.
- Full rationale: `docs/architecture/ARCHITECTURE.md`. Decision log: `docs/DECISIONS.md`.

## Safety rules (non-negotiable)
- Secrets (LLM keys, OAuth client secrets, refresh tokens, service-role keys) live server-side only, in Supabase Edge Function secrets. Never in a client app, never in git.
- The LLM only proposes structured actions. The backend validates them; the LLM never executes anything directly.
- Outward-facing actions (creating events, sending messages, …) run only after explicit user confirmation, given per action. LUNA owns that confirmation; never rely on the execution layer's "always approve" memory.
- The LLM provider stays swappable: provider-specific code lives only in `supabase/functions/_shared/llm/`.
- Always inject the current local datetime and timezone (`DEFAULT_TIMEZONE`, default `Asia/Jakarta`) into LLM prompts.

## Workflow
- Work proceeds in stages. Read the active stage instructions before doing stage work.
- Integration order: Discover → Understand → Map → Compare → Recommend → Approve → Integrate.
- Inspect actual source (LUNA's and Jarvis') before modifying or integrating it. Never integrate a component just because documentation says it exists.
- Do not copy or merge Jarvis code into LUNA unless Nanda explicitly authorizes it. (Authorized layout for later: a git subtree in a dedicated Jarvis folder, ADR-014. Adding it still needs a go-ahead.) LUNA code never imports from the Jarvis folder.
- Do not build speculative future-stage architecture.
- Deferred decisions stay deferred (see `docs/DECISIONS.md`). If one blocks a task, explain why and propose the smallest reversible step.
- Claude is the engineering executor, not the final architecture owner. When findings conflict with a recorded decision, do not silently change the architecture. Report: finding → evidence → impact → options → recommendation → whether the stage must change.

## Repository map
- `supabase/` — LUNA backend: migrations + Edge Functions (Deno/TypeScript)
- `android-app/` — client app (paused; voice/mobile are out of Stage 1 scope)
- `docs/architecture/` — architecture docs and reconnaissance reports
- `docs/DECISIONS.md` — decision log (accepted and deferred decisions)
- `STAGE_<n>/` — stage-specific instructions and scope

## Current stage: Stage 2 (started 2026-10-14)
Source of truth for Stage 2 is the `stage-2/` folder. Read in this order: `stage-2/CLAUDE_STAGE_2_START_HERE.md` → `stage-2/STAGE_2_PLAN.md` → `stage-2/STAGE_2_PROGRESS.md`; `stage-2/docs/` are the design guides.
Record every Stage 2 decision and progress step in `stage-2/STAGE_2_PROGRESS.md` (and `stage-2/docs/DECISIONS.md`), so work can be backtracked or redone.
@stage-2/CLAUDE_STAGE_2_START_HERE.md

Stage 1 (completed 2026-10-14): `STAGE_1/CLAUDE_STAGE_1.md`.

## Working style
- Explain trade-offs before big changes. Ask before anything irreversible.
- Smallest working step first, then iterate.
