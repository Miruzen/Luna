# Stage 3 Plan — LUNA Readiness & Jarvis Integration

**Status:** Planning  
**Priority:** Stage 3.1 first  
**Audience:** Claude Code / implementation partner  
**Purpose:** Establish the scope, sequence, constraints, and acceptance gates for Stage 3. Do not treat this document as proof of the current repository state; inspect the actual code before implementation.

---

## 1. Direction and Structure

Stage 3 has exactly two phases:

- **Stage 3.1 — LUNA Readiness**
- **Stage 3.2 — Real Jarvis Integration**

Stage 3 is expected to take longer than earlier stages because it covers both stabilization of the existing LUNA web app and integration of the real Jarvis execution engine.

**Execution rule:** Work on Stage 3.1 first. Do not begin full Jarvis integration implementation until Stage 3.1 has passed its acceptance criteria. Preliminary cloud-host research and lightweight architecture planning may happen in parallel, but must not distract from Stage 3.1.

## 2. Stage 3.1 — LUNA Readiness (First Priority)

### Goals
Make the existing LUNA web client usable and testable end-to-end before integrating the real Jarvis engine.

### Work areas
1. Inspect the current repository and compare actual implementation with the latest project summary and architecture decisions.
2. Run the web client locally and document the setup steps.
3. Verify Google OAuth/login, redirect URI configuration, and the current authentication flow.
4. Test the full user journey:
   - User submits an intent.
   - LUNA generates a structured proposal.
   - Backend validates the proposal.
   - User explicitly approves the proposed outward-facing action.
   - Execution occurs.
   - LUNA checks the result against the approved intent.
   - The UI displays the result and any relevant event link.
5. Fix issues that prevent the agreed flow from working reliably.
6. Define and document acceptance criteria before making broad changes.

### Stage 3.1 acceptance gate
Claude should propose testable acceptance criteria after inspecting the actual repository. At minimum, verify:
- The app can be started locally using documented steps.
- Google authentication works in the intended test setup.
- The intent → proposal → approval → execution → result flow works end-to-end.
- An outward-facing action cannot execute without explicit user approval.
- The UI reports success/failure accurately and does not misrepresent a failed or incomplete action as successful.
- Existing tests continue to pass, with new regression tests added for bugs fixed during this phase.
- Secrets remain server-side and are not exposed to the client or committed to Git.

Do not mark Stage 3.1 complete until its acceptance criteria and any required manual checks have been explicitly reported.

## 3. Stage 3.2 — Real Jarvis Integration

Begin only after Stage 3.1 is accepted.

### Goals
Integrate the real OpenJarvis execution engine into the LUNA project and prove that LUNA can delegate one real, approved action to Jarvis.

### Repository direction
Target one GitHub repository containing separate LUNA and Jarvis directories, subject to actual repository inspection and the existing fork-first / Git-subtree decision. Do not overwrite or restructure existing code without first explaining the plan and risks.

### Work areas
1. Inspect the selected OpenJarvis source, its dependencies, runtime requirements, license, and tool-calling behavior.
2. Import/pull the source into the repository using the agreed fork-first approach. Prefer the previously discussed Git-subtree strategy if it remains appropriate after inspection.
3. Establish a real transport between LUNA and Jarvis.
4. Prefer a Supabase mailbox/queue design in which LUNA writes a work request and Jarvis polls/claims it. Avoid requiring an inbound connection to the user's personal PC.
5. Run Jarvis on a cloud host so it can continue operating while the user's PC is off.
6. Move Google Calendar event creation through Jarvis, following the existing work-item lifecycle and safety rules.
7. Test end-to-end delegation, explicit approval, idempotency, retry behavior, timeout recovery, tool-level verification by Jarvis, and outcome-level acceptance checks by LUNA.
8. Document deployment, secrets/configuration, recovery, logs, and operational limitations.

### Stage 3.2 acceptance gate
Claude should propose final testable criteria after inspecting the source and runtime requirements. At minimum:
- LUNA can dispatch one approved Calendar-create request to the real Jarvis runtime.
- Jarvis receives the work request through the agreed transport and returns a structured result.
- Jarvis cannot self-approve outward-facing actions or expand its own permissions.
- The same work-item/request ID is used consistently for idempotency; retries do not create duplicate Calendar events.
- Jarvis verifies tool-level execution, and LUNA checks the resulting event against the approved intent (including relevant title and start/end times).
- Timeout/retry and stale-result behavior are tested.
- The cloud runtime can operate while the user's PC is off, subject to the selected provider's availability and free-tier restrictions.
- Existing tests and new integration tests pass; manual verification steps are recorded.
- Deployment and recovery instructions are documented.

## 4. Cloud Hosting Research — Candidate, Not Yet Final

**Leading candidate to evaluate first:** Oracle Cloud Always Free.  
**Alternative to compare:** Google Cloud Free Tier.

These are candidates for research, not finalized infrastructure decisions. Do not provision infrastructure or incur costs without explicit user approval.

Verify current terms and practical suitability before choosing:
- Free-tier eligibility and availability in the user's region/account.
- CPU/RAM and storage requirements for the actual Jarvis source and dependencies.
- ARM compatibility if considering an Oracle ARM instance.
- Whether Docker is useful and supported for the deployment.
- Whether the process can run continuously and poll Supabase reliably.
- Idle-instance reclamation/suspension rules, networking, persistence, and quotas.
- Outbound connectivity to Supabase and OpenRouter.
- Billing risks and available spending safeguards.

The initial model approach remains cloud API via OpenRouter. **Do not add Ollama or local-model hosting to Stage 3 unless the user explicitly approves a scope change.** No GPU should be assumed necessary while inference remains API-based.

A free tier must not be treated as a guarantee of uninterrupted, production-grade availability. If the candidate is unsuitable, compare alternatives and explain the trade-offs before committing.

## 5. Non-Negotiable Architecture and Safety Constraints

Preserve the current agreed principles unless a concrete conflict is found. If a change appears necessary, explain the reason, alternatives, and consequences before implementation.

- **Authority:** Nanda/user is the highest authority. LUNA handles intent, context, strategy, permissions, and approval; Jarvis handles execution.
- **Explicit approval:** Every outward-facing action requires explicit user approval per action. Jarvis must never self-approve.
- **Single writer:** Only the LUNA backend changes work-item state. The client and execution engine request changes; LUNA validates them.
- **Idempotency:** Use the work-item/request ID consistently as the idempotency key for outward actions.
- **Verification split:** Jarvis verifies tool-level execution; LUNA verifies the outcome against the approved intent.
- **Secrets:** Credentials and secrets remain server-side (for example, in Supabase Edge Function secrets). Never expose secrets in client code or commit them to Git.
- **Structured proposals:** LLMs may propose structured actions, but backend validation must govern execution. No direct unvalidated LLM-to-tool execution.
- **Context projection:** Keep context allowlisted and minimal; do not send raw conversation history or personal facts by default.
- **Swappable providers:** Keep provider-specific code isolated behind existing abstractions.
- **Local time:** Preserve explicit Asia/Jakarta timezone handling where dates/times are involved.
- **Scope control:** Do not silently add long-term memory, multi-step missions, proactive scheduling, broad new capabilities, or Ollama/local inference to Stage 3.

## 6. Out of Scope Unless Explicitly Reapproved

- Long-term memory or a persistent user-profile system.
- Multi-step missions or parent/child orchestration.
- Proactive scheduling or autonomous outward-facing actions.
- A general-purpose permission/risk framework beyond what the agreed integration requires.
- Android client work.
- Ollama or local-model inference.
- Additional action capabilities beyond the agreed initial Calendar-create integration.

## 7. Working Protocol for Claude Code

1. Start by inspecting the actual repository, current branch, working tree, tests, and relevant architecture/decision documents. Do not assume the project summary reflects every current code change.
2. Report discrepancies between the summary and source before making architectural changes.
3. Keep Stage 3.1 as the immediate focus. Do not start Stage 3.2 implementation early.
4. Work in small, reviewable increments. Before destructive changes or major restructuring, explain the plan and wait for approval.
5. Before implementation, propose a concise task breakdown and acceptance criteria for the active phase.
6. Run relevant tests after each meaningful change and report exact results, including failures and untested manual steps.
7. Do not provision paid resources, enable billing, or incur costs without explicit approval.
8. Preserve existing ADRs and decisions unless proposing a clearly justified change for review.
9. At the end of each phase, provide a handoff summary: changes made, files affected, tests run, results, known limitations, and recommended next step.

## 8. Handoff Between Stage 3 and Stage 4

Stage 4 is intentionally **not defined in this document**. Its direction will be decided after Stage 3 results are reviewed.

At the end of Stage 3, produce a structured report covering:
- What was completed in Stage 3.1 and 3.2.
- Architecture and repository changes.
- Actual cloud provider/tier and operational constraints, if deployed.
- Tests and manual verification performed, including failures.
- Security/approval/idempotency/verification behavior confirmed.
- Remaining technical debt, risks, and unresolved decisions.
- Capabilities now available and capabilities still missing.
- Evidence that can help decide the next stage.

Do not pre-commit Stage 4 scope. The user will provide the Stage 3 outcome to Merlin for strategic review and Stage 4 direction-setting.
