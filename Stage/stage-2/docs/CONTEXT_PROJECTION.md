# Context Projection — Workstream 2 draft

Status: **Implemented (option A) on 2026-10-15** (DEC-005).
- Code: `supabase/functions/_shared/execution/projection.ts` (generic, deterministic projector), `policies.ts` (calendar policy), contract fields `inputs?` / `ContextItem.source?` in `contract.ts`; the Jarvis adapter renders `inputs` as JSON.
- Tests: `projection_test.ts` (9) + 1 adapter test.
- Not wired into the live flow by design: nothing calls `delegate()` live yet, and the live calendar path already sends only the approved args.
Labels: **[FACT]** verified in code · **[PROPOSAL]** recommendation · **[OPEN]** needs a decision.

## 1. Current state

**What LUNA holds about Nanda today:**
- [FACT] Conversation turns: the last 10 per session (`conversation_turns`). These go to **LUNA's own** LLM in `luna-intent`, not to any execution engine.
- [FACT] The timezone preference (`DEFAULT_TIMEZONE`, global config, not per user).
- [FACT] Google refresh token (`user_google_tokens`): a credential, service-role only.
- [FACT] Work items: the approved args per action (`work_items.args`).
- [FACT] **There is no long-term memory, preference or profile store yet.** "Personal context" today is effectively the timezone plus the current conversation.

**What the contract can carry:**
- [FACT] `ExecutionRequest` (`contract.ts`) carries `objective`, `context: {kind, content}[]`, `constraints: string[]`, `expected_output`, `permissions`, `approval`, `operational_state`.
- [FACT] There is **no structured input field**. Validated, typed data (e.g. calendar args) can only travel as prose in `objective`/`context`. The Jarvis adapter flattens everything into one text query (`jarvis/adapter.ts:124`).
- [FACT] `ContextItem` has no `source`, so a context line cannot be traced back to where it came from.
- [FACT] Nothing builds an `ExecutionRequest` in a live flow yet. The live calendar path calls Google directly with `work_items.args`, so it already sends only what is needed.

## 2. Principle [PROPOSAL]

**Default deny, per capability.** For each capability (e.g. `calendar.events.create`), LUNA keeps a small **projection policy** listing exactly which context the executor may receive. Anything not on the list is not sent. Personal context is never sent "just in case".

**Bahasa awam:** setiap jenis tugas punya **daftar isi map dokumen** yang sudah ditentukan. Kontraktor cuma dapat isi map itu, bukan seluruh lemari arsip.

## 3. Mapping the four context classes onto the existing contract

| Context class (guide) | Contract field (existing) | Change needed? |
|---|---|---|
| 1. Personal (preferences, facts) | `context[]` with `kind: "preference" \| "fact"` | No. Excluded unless the policy allows it. |
| 2. Strategic (goal, intent, priority, rationale) | `objective` (+ optional `context[]` `kind: "goal"`) | No |
| 3. Execution (instructions, inputs, resources, constraints, success criteria) | `objective`, `constraints`, `expected_output`, `context[]` `kind: "resource"` | **Yes: structured `inputs`** (see §5) |
| 4. Safety/permissions | `permissions`, `approval` | No (already enforced by `validateExecutionRequest`) |

## 4. Field rules (calendar.events.create as the worked example)

| Field | Meaning | Required? | Source / owner | Why the executor needs it | Sensitivity / default | If missing | If contradictory |
|---|---|---|---|---|---|---|---|
| `objective` | One-line task statement | Required | LUNA (generated from the work item) | Says what to do | Low | Don't delegate | n/a |
| `inputs` (proposed) | Validated args: title, start, end, timezone, description?, attendees? | Required for this capability | `work_items.args` (what Nanda approved) | The executor must use **exactly** these values, without re-interpreting text | Medium (attendee emails) | Don't delegate. Ask Nanda before the proposal (already handled by the `luna-intent` clarification). | End before start, invalid tz, etc. are refused by `validateEventArgs` before a proposal exists |
| `constraints` | Hard rules, e.g. "use timezone Asia/Jakarta", "do not invite anyone not listed" | Optional | LUNA policy | Bounds HOW | Low | Fine | A constraint that conflicts with `inputs` → LUNA refuses to dispatch and asks Nanda. **The executor never resolves conflicts**, because that is a strategic decision (ADR-012). |
| `expected_output` | What must come back (event id + link) | Required | LUNA policy | Defines success | Low | Don't delegate | n/a |
| `permissions` | `calendar.events.create`, `outward: true` | Required | LUNA | Authorization scope | Low | Refused by the contract validator | n/a |
| `approval` | Nanda's confirmation record | Required (outward) | Work item transition `approved` | Proves Nanda confirmed (ADR-013) | Low | Refused by the contract validator | n/a |
| `context[]` `preference/fact` | e.g. "Nanda prefers 30-min meetings" | **Excluded by default** | (future memory store) | Not needed when `inputs` are explicit | Medium–high | Fine | n/a |
| Raw user utterance | "besok jam 3 sore meeting sama tim" | **Excluded by default** | `conversation_turns` | Not needed: `inputs` are the approved interpretation. Sending the raw text invites the executor to re-interpret it. | Medium (may contain unrelated personal details) | Fine | n/a |
| Conversation history | Previous turns | **Never sent** | `conversation_turns` | Not needed | High | — | — |
| Credentials | Google tokens | **Never in context** | `user_google_tokens` | Delivered by a separate mechanism (ADR-013 notes; deferred with ADR-011) | Secret | — | — |

## 5. Proposed contract additions (backward compatible) [PROPOSAL] [OPEN]

1. **`inputs?: Record<string, unknown>`** on `ExecutionRequest`: structured, already-validated task data.
   - *Why:* prose loses precision and invites re-interpretation. Today's E2E showed that a free model can misread a date ("lusa"). Once Nanda has approved exact values, nothing downstream should get a chance to re-read the words.
   - It also enables the "direct tool, no LLM" path noted for Stage 2+ (D-03 notes).
2. **`source?: string`** on `ContextItem`: e.g. `"work_item:<id>.args"`, `"config:DEFAULT_TIMEZONE"`, `"memory:<id>"`.
   - *Why:* the guide asks for traceability. It is cheap to add, and audits can see why a fact was shared.

Both fields are **optional**, so existing requests and tests stay valid. `contract_version` stays `"1"`. The Jarvis adapter would render `inputs` as a JSON block in its query instead of prose.

## 6. Missing and contradictory context: behaviour [PROPOSAL]

| Situation | Detected by | Behaviour |
|---|---|---|
| Required input missing **before** proposal | LUNA (`luna-intent` + validator) | Ask Nanda a clarifying question; no work item yet (existing behaviour) |
| Required input missing **at projection** (policy says required, work item lacks it) | LUNA (`projectContext`) | Don't dispatch; work item stays `approved`; error `missing_context` with the field names |
| Engine says it lacks information | Engine → `needs_input` | LUNA decides: supply it (`provide_input`, attempt + 1) or ask Nanda. The engine never guesses. |
| Contradiction between fields (e.g. constraint vs input) | LUNA (`projectContext`) | Don't dispatch; ask Nanda. The engine is never asked to choose. |
| Context not on the policy list | LUNA (`projectContext`) | Silently excluded, and the exclusion counted in the audit note |

## 7. Examples

**Valid minimal projection (`calendar.events.create`):**
```json
{
  "contract_version": "1",
  "request_id": "9559ae7d099544ffb530c9a3a3358d41",
  "objective": "Create a Google Calendar event with exactly the given inputs.",
  "inputs": { "title": "TEST LUNA", "start_datetime": "2026-10-16T16:00:00+07:00",
              "end_datetime": "2026-10-16T16:15:00+07:00", "timezone": "Asia/Jakarta" },
  "context": [],
  "constraints": ["Do not invite anyone not listed in inputs.attendees."],
  "expected_output": { "description": "Created event id and link" },
  "permissions": [{ "capability": "calendar.events.create", "outward": true }],
  "approval": { "approved_by": "nanda", "approved_at": "2026-10-15T09:03:31+07:00", "confirmation_id": "9559ae7d099544ffb530c9a3a3358d41" },
  "operational_state": { "attempt": 1, "session_id": "f0b9f54f-…" }
}
```
Not included: the raw utterance, conversation history, preferences, tokens.

**Missing required context:** a work item for `calendar.events.create` whose args lack `start_datetime` gives `projectContext` → `{ ok: false, error: "missing_context", fields: ["start_datetime"] }`. Nothing is dispatched.

**Unrelated context excluded:** a future memory fact such as "Nanda's mother's birthday is 3 May" is never added to a calendar-create request, even if it exists. It is not on the policy list.

## 8. Implementation slice options

| Option | What | Pros | Cons |
|---|---|---|---|
| **A** (recommended) | Pure `projectContext(capability, workItem, policy)` in `_shared/execution/projection.ts` + calendar policy + the two optional contract fields + Jarvis adapter renders `inputs` + tests. No live-flow change. | Small and testable. Ready for when the Jarvis transport exists. The live flow already sends minimal data. | Not exercised live until something calls `delegate()` |
| B | A + route the live calendar call through `delegate()` with a native calendar engine | Exercised live | This is effectively Stage 1's Option A (native adapter), which Nanda did not choose (ADR-011 = Option B). It would change the decided direction. |

## 9. Test plan (option A)
- Valid projection: exactly the policy fields; `inputs` equal `work_items.args`.
- Default deny: preference/fact/raw-utterance items supplied → excluded.
- Missing required input → `missing_context` with field names; no request built.
- Contradiction (constraint vs inputs, e.g. the attendee constraint violated) → refused.
- Built request passes `validateExecutionRequest` (outward needs approval).
- Backward compatibility: existing Stage 1 tests unchanged and passing.
- Jarvis adapter: `inputs` rendered as structured JSON in the query; no raw history.

## 10. Decisions needed from Nanda
1. **Contract additions** `inputs` and `ContextItem.source` (optional, backward compatible): OK?
2. **Implementation slice:** A (recommended) or B?
3. Raw utterance and personal context **excluded by default** per capability: OK?
