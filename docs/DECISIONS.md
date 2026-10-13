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

### ADR-013 notes
- The execution layer must not re-prompt for approval and must not remember approvals of its own (cf. Jarvis `approval_store` "always approve", recon F6). An escalation (`needs_approval`) happens only when a task needs something **outside** the permissions LUNA granted.
- Nanda's per-action confirmation is unchanged (ADR-012). LUNA approves only what Nanda confirmed.
- Open, tied to ADR-011/D-01: *how* a credential reaches Jarvis at execution time. Options: a short-lived access token per request (least privilege, recommended) vs handing over the refresh token (broader exposure). Not implemented in Stage 1.

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

### D-02 — Codebase strategy: fork vs contribute upstream
| | Fork | Upstream PR |
|---|---|---|
| Speed / control | Immediate, full control | Depends on maintainer review |
| Maintenance | We carry merges from a fast-moving upstream (1,200+ commits, Alpha) | Upstream maintains it |
| Fit for LUNA-specific needs | Any change possible | Only generally useful changes are accepted |

Evidence so far: Apache-2.0 allows both. Changes likely needed: create-event (ADR-011), DeepSeek tool forwarding (recon F4), and possibly memory/persona switches (D-04).
Does not block Stage 1.

### D-03 — Model fallback if DeepSeek tool-calling proves unreliable
Options: fix the DeepSeek path in Jarvis (ties to D-02); use another provider inside Jarvis (OpenAI/Anthropic/Google); route via OpenRouter/LiteLLM (tool forwarding not verified); use a local model via Ollama (ties to D-01 hardware).
Evidence so far: Jarvis' `_generate_deepseek` does not forward `tools`, while the OpenAI path does (recon §3.5, F4). **Inference only; not runtime-tested.** LUNA's own DeepSeek integration (`luna-intent`) is separate and unaffected, but it is also not yet verified end-to-end (baseline test on hold).
Smallest reversible step when this becomes blocking: one runtime test of a Jarvis agent with one tool on DeepSeek, before choosing.
Does not block Stage 1 (mocked adapter).

### D-04 — Jarvis memory/persona: preserve, adapt, or disable
| | Preserve | Adapt | Disable |
|---|---|---|---|
| Effort | None | Patch/configure | Config only (if switches suffice) |
| Ownership (ADR-001/007/008) | Conflicts: Jarvis builds its own memory of the user from LUNA's delegated context | Possible with clear scoping | Cleanest |
| Jarvis execution quality | Full | Partial | May lose context Jarvis agents expect |

Evidence so far: Jarvis injects SOUL/MEMORY/USER persona files (`prompt/builder.py`), maintains `USER.md`, runs background fact extraction (`memory/service.py`, default not confirmed), and has `agent.context_from_memory = True` by default (recon §3.9, F3).
Does not block Stage 1. The adapter contract sends only explicitly projected context, which keeps every option open.
