# Agent and Tool Ownership — Workstream 3 draft

Status: **Accepted and implemented (slice B) on 2026-10-15** (DEC-006, ADR-017, ADR-018). F3 is fixed (`jarvis/adapter.ts`, test in `adapter_test.ts`); the F2 rule is in the `contract.ts` comments and ADR-018; F1's acceptance check is a requirement for ADR-011. Validated against LUNA's code and OpenJarvis source @ `c14f579` (static reading; nothing in Jarvis was run).
Row status: **verified** = seen in code · **proposed** = recommendation · **unresolved** = needs a decision or runtime evidence.

## 1. Responsibility map

| Responsibility | Owner | Status | Evidence / notes |
|---|---|---|---|
| User intent and strategic goals | LUNA | **verified** | `luna-intent`: LLM proposes, `validateEventArgs` validates, Nanda confirms |
| Personal context selection | LUNA | **verified** (code), not live | `_shared/execution/projection.ts` + `policies.ts` (default deny). Live flow sends only approved args. |
| Mission direction and delegation | LUNA | **verified** (code), not live | `delegate()` in `interface.ts`; no live caller yet (Jarvis not connected) |
| Approval of outward actions | Nanda, recorded by LUNA | **verified** | Work-item `approve` transition (actor `nanda`); contract refuses outward permissions without approval |
| Execution request/result boundary | Shared interface | **verified** | `contract.ts` (+ `inputs`/`source`, DEC-005); `validateExecutionRequest`/`Result` |
| Request/result correlation | Shared interface | **verified** | `request_id` = work-item id; results accepted only for the current attempt (`workItem.ts`, `stale_result`) |
| Shared state (status, attempts, audit) | LUNA (single writer) | **verified**, live | `work_items` / `work_item_events`; engines only report via `ExecutionResult` |
| Execution-side planning | Jarvis | **verified** (source) | `agents/orchestrator.py`: LLM loop, up to 10 turns, chooses tools itself (l.37–38, 171) |
| Tool selection | Jarvis, **within LUNA's allow-list** | **verified** (source + adapter) | Jarvis picks tools; the adapter passes only the tools mapped from LUNA's permissions and fails with `permission_violation` if any other is used (`jarvis/adapter.ts`) |
| Tool / MCP execution | Jarvis | **verified** (source), not runtime-tested | `tools/_stubs.py` `ToolExecutor`; `mcp/` client+server (recon §3.3, §3.7) |
| Retries **within one attempt** | Jarvis | **verified** (source) | `agents/executor.py:27,313`: `_MAX_RETRIES = 3` with backoff, managed-agent path only. The SDK `ask_full()` path has no retry. |
| Retries **across attempts** | LUNA | **verified**, live | Work item `failed`(retryable) → `retry`, attempt + 1, same id |
| Idempotency of outward actions | Executor's tool, keyed by LUNA's `request_id` | **proposed** | Today the live calendar call uses the work-item id as the Google event id. A future Jarvis create-event tool (ADR-011) **must** do the same (see F2). |
| Execution-level checks ("did the tool succeed?") | Jarvis | **verified** (source) | `ToolResult.success` per tool call |
| Result verification ("is the outcome what was asked?") | **unresolved** → proposed: LUNA | **unresolved** | **No generic verification step found in Jarvis agents** (see F1). LUNA validates result *shape* only today. |
| Partial / max-turns results | Adapter must detect → LUNA decides | **verified** (fixed 2026-10-15, F3) | Jarvis returns "Maximum turns reached without a final answer." with `max_turns_exceeded` metadata (`agents/_stubs.py:313–330`). `ask_full()` does not pass that metadata, and **our adapter maps it to `completed`** (`jarvis/adapter.ts:96`). See F3. |
| Final user-facing synthesis | LUNA | **verified** | User-facing replies come only from `luna-intent` / `luna-execute` |
| Credentials | LUNA (Supabase) | **verified** (decision), delivery **unresolved** | ADR-013. How a credential reaches Jarvis is deferred with ADR-011/D-01. |

## 2. Review questions

| Question | Answer |
|---|---|
| Where does LUNA end and Jarvis begin? | At `delegate()`. Everything before it (intent, approval, projection, state) is LUNA. Everything inside `execute()` (planning, tools, in-attempt retries) is Jarvis. Everything after it (accepting the result, updating state, telling Nanda) is LUNA. |
| Can Jarvis revise a plan without asking LUNA? | **Yes, for HOW**: it may change tools or steps freely within the allow-list and the request's `inputs`. **No, for WHAT**: it cannot change inputs, widen permissions or pick between contradictory instructions. Those escalate as `needs_input` / `needs_approval` (ADR-012). |
| Which actions require user approval? | Every outward action, per action (CLAUDE.md safety rules). LUNA's approval then covers the execution layer; Jarvis does not ask again (ADR-013). |
| Who owns retries and idempotency? | Two layers (F2): Jarvis retries inside an attempt; LUNA retries across attempts. Both are safe only if the outward tool is idempotent on `request_id`. |
| Who verifies the outcome? | Jarvis checks "the tool call succeeded". LUNA should check "it matches what was approved" (F1, proposed). |
| Partial, ambiguous or failed result? | Failed → `failed` (retryable or not). Partial or max-turns → **should** map to `failed` (retryable) or `needs_input`, never `completed` (F3). Ambiguous outcome after a timeout → `failed` with `outcome_unknown` (STATE_OWNERSHIP §3). |

## 3. Findings (architecture decision protocol)

### F1 — Jarvis has no generic result-verification step
1. **Finding:** Stage 1 locked decision 8 lists "execution verification" under Jarvis. In the source, the standard agents return their final answer as soon as the LLM stops calling tools. "verify/verification" appears only in research/hybrid agents and error handling.
2. **Evidence:** `agents/orchestrator.py` (l.37–38: no tool_calls → final answer); grep for verification in `agents/` matches only `errors.py`, `hybrid/*`, `templates/code_reviewer.toml`.
3. **Impact:** if LUNA assumes Jarvis verified the outcome, a wrong but "successful" result would be accepted silently.
4. **Options:** a) LUNA adds a per-capability **acceptance check** (e.g. created event's start/end equal `inputs`); b) build verification into Jarvis (fork, ADR-014); c) accept the risk.
5. **Recommendation:** a, small and engine-agnostic. Jarvis keeps tool-level success checks.
6. **Stage change?** No. It refines decision 8: "execution verification" = tool-level checks in Jarvis + outcome acceptance in LUNA. Recorded for Nanda (DEC-006).

### F2 — Two retry layers can duplicate outward actions
1. **Finding:** Jarvis' managed-agent path retries up to 3× inside one attempt; LUNA retries across attempts.
2. **Evidence:** `agents/executor.py:27,313`; `_shared/state/workItem.ts` (`retry`).
3. **Impact:** a non-idempotent tool (e.g. "send message") could run several times for one approval.
4. **Recommendation:** make it a contract rule that **outward tools must be idempotent on `request_id`**. The ADR-011 create-event tool must use it as the Google event id, as LUNA already does today.
5. **Stage change?** No. It becomes a requirement for ADR-011.

### F3 — Adapter reports Jarvis' "max turns reached" as completed
1. **Finding:** when Jarvis runs out of turns it returns a fixed message plus metadata. `ask_full()` drops the metadata, and our adapter maps any run without failed tools to `completed`.
2. **Evidence:** `agents/_stubs.py:313–330`; `sdk.py:585–599` (no metadata in the output); `jarvis/adapter.ts:96`.
3. **Impact:** an unfinished task would be shown to Nanda as done.
4. **Recommendation:** the adapter detects the max-turns message (exact string from source) and maps it to `failed` with `retryable: true` and code `engine_incomplete`. Add a test.
5. **Stage change?** No. It is a small adapter fix with no live effect today.

## 4. Implementation slice options

| Option | What | Pros | Cons |
|---|---|---|---|
| A | Docs only (this file) | Zero code | F3 stays a latent bug |
| **B** (recommended) | Docs + F3 adapter fix + test + record the F2 idempotency rule in the contract comments and ADR-011 notes | Small, tested, no live change | — |
| C | B + LUNA acceptance check (F1) for calendar | Closes F1 | Needs the executor to return the created event's times. The live path could do it now, but it changes the live flow. Better done together with ADR-011. |

## 5. Decisions needed from Nanda (DEC-006)
1. Accept the responsibility map (§1), including "Jarvis may revise HOW, never WHAT"?
2. F1: outcome verification belongs to LUNA (acceptance check), Jarvis keeps tool-level checks?
3. Implementation slice: B (recommended)?
