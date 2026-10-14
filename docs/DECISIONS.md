# LUNA — Decision Log

Statuses: **ACCEPTED** (in force) · **ACCEPTED (deferred)** (decided, not yet implemented) · **DEFERRED** (intentionally undecided, needs evidence) · **SUPERSEDED**.

## Accepted decisions

| ID | Decision | Status | Date |
|---|---|---|---|
| ADR-001 | LUNA is the architectural center | ACCEPTED | Stage 1 |
| ADR-002 | LUNA owns Strategic Orchestration | ACCEPTED | Stage 1 |
| ADR-003 | Jarvis is an execution layer, not LUNA's center | ACCEPTED | Stage 1 |
| ADR-004 | LUNA ↔ execution uses an engine-agnostic boundary | ACCEPTED | Stage 1 |
| ADR-005 | Execution Interface is the replaceability boundary | ACCEPTED | Stage 1 |
| ADR-006 | Jarvis owns execution agents | ACCEPTED | Stage 1 |
| ADR-007 | LUNA owns intent, mission, context, outcome and delegation | ACCEPTED | Stage 1 |
| ADR-008 | Execution agents do not automatically receive all LUNA memory | ACCEPTED | Stage 1 |
| ADR-009 | Jarvis source must be inspected before deep integration | ACCEPTED | Stage 1 |
| ADR-010 | Future architecture must not be silently implemented in Stage 1 | ACCEPTED | Stage 1 |
| ADR-011 | Calendar event creation moves into Jarvis by adding a create-event capability to OpenJarvis ("Option B") | ACCEPTED (deferred) | 2026-10-07 |
| ADR-012 | Decision hierarchy: Nanda (final authority) → LUNA (second decision maker) → execution layer (HOW only, no strategic decisions); escalation goes upward | ACCEPTED | 2026-10-13 |
| ADR-013 | Execution credentials (e.g. Google OAuth) are owned by LUNA and stored in Supabase. LUNA's approval (given after Nanda's per-action confirmation) is the authorization for the execution layer: Jarvis and below execute without asking again | ACCEPTED | 2026-10-13 |
| ADR-014 | Codebase strategy: **fork-first**. LUNA carries its own fork of OpenJarvis; upstream contributions are optional. A weekly upstream review decides which new Jarvis changes to adopt. Layout: git subtree in a dedicated Jarvis folder inside the LUNA repo. | ACCEPTED | 2026-10-13 |
| ADR-015 | Jarvis' own memory and persona are **disabled** when used by LUNA. Re-evaluate 2–3 months after LUNA has more systems running (target review: 2027-01) | ACCEPTED (provisional) | 2026-10-13 |
| ADR-016 | LLM access uses **OpenRouter as one path, never the only one**: LUNA keeps a provider fallback chain (e.g. OpenRouter → DeepSeek direct) so an OpenRouter outage does not stop LUNA. Applies to LUNA now and to Jarvis later. Resolves D-03. | ACCEPTED (implemented in code 2026-10-14; not deployed) | 2026-10-13 |

### ADR-013 notes
- The execution layer must not re-prompt for approval and must not remember approvals of its own (cf. Jarvis `approval_store` "always approve", recon F6). An escalation (`needs_approval`) happens only when a task needs something **outside** the permissions LUNA granted.
- Nanda's per-action confirmation is unchanged (ADR-012). LUNA approves only what Nanda confirmed.
- Open, tied to ADR-011/D-01: *how* a credential reaches Jarvis at execution time. Options: a short-lived access token per request (least privilege, recommended) vs handing over the refresh token (broader exposure). Not implemented in Stage 1.

### ADR-014 notes
- **Layout decided (2026-10-13): option b**, a git subtree inside the LUNA repo in a **dedicated Jarvis folder** (proposed name `jarvis/` at repo root). One repo and one commit flow; upstream updates are pulled with `git subtree pull`. Rejected: a) separate fork repo (two repos to manage) and c) plain copy (makes weekly upstream updates impractical).
- Not executed yet. Adding the subtree is a Stage 2 step and needs a go-ahead. Recommended: `--squash`, so LUNA's history does not absorb Jarvis' 1,200+ commits while `git subtree pull --squash` still works.
- Boundary still applies: LUNA code never imports from the Jarvis folder. LUNA talks to Jarvis only through the Execution Interface and the adapter. Keep Jarvis' `LICENSE` (Apache-2.0) inside the folder and mark our modifications.
- Weekly upstream review: compare upstream changes since the last sync, then classify them as adopt / skip / investigate, with special attention to security fixes and license changes. The mechanism (manual checklist vs scheduled agent) is not decided.
- Upstream PRs are only for generally useful fixes (e.g. DeepSeek tool forwarding), when convenient.

### ADR-015 notes
- Applies to persona files (SOUL/USER), background fact extraction and `agent.context_from_memory`. The exact switches and their effect must be verified at runtime when Jarvis is first run.
- Review criterion: does disabling them measurably hurt Jarvis' execution results once LUNA passes richer projected context?

### ADR-016 notes
- Research: `docs/research/OPENROUTER.md` (pricing, free-tier limits, fallbacks, tool calling).
- Two layers of resilience: (1) OpenRouter's own `models` fallback list covers a model or provider failing; (2) LUNA's provider chain covers OpenRouter itself failing.
- Proposed implementation, all inside `supabase/functions/_shared/llm/` (provider-specific code rule): add an `openrouter` provider via the existing OpenAI-compatible class, plus a fallback wrapper that tries providers in order on network/5xx/429/402 errors. Configured with env: e.g. `LLM_PROVIDERS=openrouter,deepseek`. Each provider has its own model setting.
- For Jarvis: its built-in `openrouter/` engine path forwards tools (recon), so no fork patch is needed for this.

### Architectural invariant
If Jarvis is removed tomorrow, LUNA's strategic core must remain conceptually intact. Only the execution implementation behind the Execution Interface should need replacement.

### ADR-011 notes
- Context: OpenJarvis' Google Calendar support is read-only (+ accept/decline). It cannot create events (recon F1).
- Options considered: A) keep calendar in LUNA as a native adapter; B) add create-event to Jarvis; C) Jarvis + external Calendar MCP server.
- Not implemented yet. It depends on D-01 (hosting), D-02 (fork vs upstream) and D-03 (model/tool-calling). Until then, LUNA's existing `luna-execute` calendar path stays as-is.

## Deferred decisions

These are intentionally undecided until enough evidence exists. Do not implement assumptions about them. Evidence references point to `docs/architecture/JARVIS_REPOSITORY_RECON_STAGE_1.md` (OpenJarvis @ `c14f579`).

### D-01 — Jarvis hosting: local PC vs VPS
| | Local PC | VPS |
|---|---|---|
| Cost | No extra cost | Monthly fee; a GPU VPS is expensive |
| Availability | Only while the PC is on | Always on |
| Reachability from Supabase | Needs a tunnel (e.g. Cloudflare Tunnel) plus TLS | Public endpoint plus TLS |
| Local models (Ollama) | Uses own hardware | Needs a GPU, or cloud-model-only use |
| Data locality | Data stays at home | Data on a third-party host |

Evidence so far: Jarvis is Python plus a **mandatory** Rust extension, single-user, binds to `127.0.0.1:8000` by default, and requires `OPENJARVIS_API_KEY` for any non-loopback bind (recon §3.6, §3.14, F2). It cannot run inside Supabase Edge Functions.
Does not block Stage 1: the adapter is built and tested against a mocked Jarvis HTTP API.

**Direction from Nanda (2026-10-13), still DEFERRED:**
- AI runs on **external cloud APIs only**, not local models (local inference is avoided for hardware/electricity cost). So a VPS would not need a GPU.
- Preferred transport is the **"mailbox"/pull model**: LUNA writes execution requests to a Supabase queue and Jarvis polls and claims them. No inbound connection to Jarvis' host, so no tunnel is needed. Trade-off: polling latency and one small worker on the Jarvis side.
- PC vs VPS: Nanda is researching VPS options.
- If it runs on the PC: Jarvis and all its data/caches go on drive **D:** (C: has ~21 GB free).

### D-02 — Codebase strategy: fork vs contribute upstream
| | Fork | Upstream PR |
|---|---|---|
| Speed / control | Immediate, full control | Depends on maintainer review |
| Maintenance | We carry merges from a fast-moving upstream (1,200+ commits, Alpha) | Upstream maintains it |
| Fit for LUNA-specific needs | Any change possible | Only generally useful changes are accepted |

Evidence so far: Apache-2.0 allows both. Changes likely needed: create-event (ADR-011), DeepSeek tool forwarding (recon F4), and possibly memory/persona switches (D-04).
Does not block Stage 1.
**Decided 2026-10-13 → ADR-014 (fork-first, git subtree in a dedicated Jarvis folder).**

### D-03 — Model fallback if DeepSeek tool-calling proves unreliable
Options: fix the DeepSeek path in Jarvis (ties to D-02); use another provider inside Jarvis (OpenAI/Anthropic/Google); route via OpenRouter/LiteLLM (tool forwarding not verified); use a local model via Ollama (ties to D-01 hardware).
Evidence so far: Jarvis' `_generate_deepseek` does not forward `tools`, while the OpenAI path does (recon §3.5, F4). **Inference only; not runtime-tested.** LUNA's own DeepSeek integration (`luna-intent`) is separate and unaffected, but it is also not yet verified end-to-end (baseline test on hold).
Smallest reversible step when this becomes blocking: one runtime test of a Jarvis agent with one tool on DeepSeek, before choosing.
Does not block Stage 1 (mocked adapter).

**Update 2026-10-13:**
- Fact: Jarvis ships **no model of its own**. It is a harness that calls engines: local (Ollama, vLLM, …) or cloud (OpenAI, Anthropic, Google, DeepSeek, OpenRouter, …). Each cloud provider needs our own API key and is billed by that provider (`engine/cloud.py`, keys read from env).
- Direction: cloud APIs only (see D-01).
- Tool forwarding per cloud path in `engine/cloud.py` (source reading, **not runtime-tested**): OpenAI ✅ (`**kwargs` spread), Anthropic ✅ (converts tools), OpenRouter ✅ (explicit), DeepSeek ❌, Google/Gemini ❌. DeepSeek models may therefore work with tools **via OpenRouter** without patching the fork.
- To investigate in Stage 2: can Jarvis execute one specific tool directly, without an LLM call? For calendar, LUNA already supplies validated arguments; a direct path would make Jarvis' model cost zero for such tasks.
- Free tiers (e.g. Gemini API free tier, OpenRouter free models) exist per our general knowledge, but limits and current availability are **not verified**.
**Decided 2026-10-13 → ADR-016 (OpenRouter as one path, with LUNA-side provider fallback).** OpenRouter limits/prices verified in `docs/research/OPENROUTER.md`.

### D-04 — Jarvis memory/persona: preserve, adapt, or disable
| | Preserve | Adapt | Disable |
|---|---|---|---|
| Effort | None | Patch/configure | Config only (if switches suffice) |
| Ownership (ADR-001/007/008) | Conflicts: Jarvis builds its own memory of the user from LUNA's delegated context | Possible with clear scoping | Cleanest |
| Jarvis execution quality | Full | Partial | May lose context Jarvis agents expect |

Evidence so far: Jarvis injects SOUL/MEMORY/USER persona files (`prompt/builder.py`), maintains `USER.md`, runs background fact extraction (`memory/service.py`, default not confirmed), and has `agent.context_from_memory = True` by default (recon §3.9, F3).
Does not block Stage 1. The adapter contract sends only explicitly projected context, which keeps every option open.
**Decided 2026-10-13 → ADR-015 (disable for now, review ~2027-01).**
