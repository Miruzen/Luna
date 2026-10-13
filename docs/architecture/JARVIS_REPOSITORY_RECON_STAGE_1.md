# OpenJarvis — Repository Reconnaissance (Stage 1)

| | |
|---|---|
| Repository | https://github.com/open-jarvis/OpenJarvis |
| Commit inspected | `c14f579d864f8698fbd5d0046c2a6630d2f90667` (2026-10-07, `v1.0.5.dev1207-5`) |
| Date inspected | 2026-10-07 |
| License | Apache-2.0 (`LICENSE`, `pyproject.toml`) |
| Maturity | `Development Status :: 3 - Alpha` (pyproject classifier) |
| Method | Static source reading of a local clone (outside the LUNA repo). Nothing was installed or executed. |

Every statement below is tagged:
- **[SRC]** verified by reading the source at the commit above (file cited)
- **[DOC]** stated in Jarvis docs/README, not verified in source
- **[INF]** my inference or assumption, not verified

Depth per area is stated honestly in §3. "Skimmed" means the directory listing, the module headers and the key classes were read, not every line.

---

## 1. What OpenJarvis actually is

**[DOC]** A *local-first personal AI framework* from Stanford (Hazy Research / Scaling Intelligence Lab). It is also a research platform: energy/FLOPs/latency evals plus a learning loop trained on local traces. It ships as a CLI (`jarvis`), a FastAPI server, a React/Tauri desktop app and a Python SDK.

**[SRC]** Size: about 185k lines of Python in `src/openjarvis` across 33 packages. The largest are `evals` (37k), `agents` (24k), `cli` (17k), `learning` (14k), `tools` (14k), `connectors` (13k) and `server` (12k). It also has a mandatory Rust extension (17 crates), 643 test files, a React frontend and a Tauri desktop shell.

**Key point for LUNA [SRC+INF]:** OpenJarvis is designed as a **complete personal assistant in its own right**, not a headless execution engine. It has its own persona (`SOUL`), its own user profile (`USER.md`), memory, channels (WhatsApp, Telegram, …), voice and UI. See Finding F3.

---

## 2. Source-tree map (`src/openjarvis/`)

| Package | Size | Role |
|---|---|---|
| `core/` | 3.8k | Config (`JarvisConfig`, 2.5k lines), registries, types, EventBus, credentials |
| `sdk.py` | 677 | `Jarvis` class: `ask()`, `ask_full()`, `ask_stream()` — programmatic entry point |
| `engine/` | 5.7k | `InferenceEngine` ABC + Ollama, vLLM, SGLang, llama.cpp, MLX, Apple FM, LiteLLM, Cloud (OpenAI/Anthropic/Google/DeepSeek/MiniMax/OpenRouter/Atlas) |
| `intelligence/` | 1.2k | Model catalog / registry |
| `agents/` | 24k | `BaseAgent`, orchestrator, ReAct, CodeAct, operative, monitor, morning digest, deep research, Claude Code / OpenHands wrappers, `AgentManager` + `AgentExecutor` |
| `tools/` | 14k | `BaseTool`/`ToolExecutor`, ~45 tools (file, shell, http, browser, code, memory, calendar-read, approvals, …), `storage/` memory backends |
| `connectors/` | 13k | ~38 data-source connectors (Gmail, Google Calendar, Drive, Notion, Slack, Apple apps, Oura, Strava, …) + OAuth |
| `mcp/` | 1.2k | MCP client + server, stdio / in-process transports |
| `a2a/` | 0.5k | Google A2A protocol types, client, server (**not wired**, see §4) |
| `memory/` | 1k | `MemoryService`: background fact extraction from conversations |
| `security/` | 4.7k | Capability RBAC, guardrails, secret/PII/injection scanners, SSRF, taint, audit log, signing, subprocess sandbox |
| `server/` | 12k | FastAPI app: OpenAI-compatible API + agents, approvals, connectors, channels, webhooks, analytics |
| `scheduler/` | 0.9k | Cron/interval/once task scheduler (SQLite) |
| `learning/`, `traces/` | 15k | Router policies, trace store/analyzer, DSPy/GEPA optimisation, SFT/GRPO stubs |
| `telemetry/`, `analytics/` | 5.4k | Local metrics (SQLite) + **external PostHog analytics** |
| `channels/` | 6.3k | 15+ messaging channels |
| `speech/` | 1.2k | STT (faster-whisper/Deepgram), TTS (Kokoro) |
| `mining/` | 2.5k | Pearl proof-of-useful-work crypto mining on the inference GPU |
| `evals/`, `bench/` | 38k | Research benchmarks |
| `sandbox/` | 0.7k | Docker/Podman container runner |
| `skills/`, `recipes/`, `templates/`, `workflow/`, `operators/`, `sessions/`, `daemon/`, `prompt/`, `system/`, `cli/` | — | Supporting subsystems |

Outside `src/`: `rust/` (17 crates mirroring the Python modules), `frontend/` (React 19 + Tauri), `desktop/`, `deploy/`, `docs/`, `tests/`.

---

## 3. Component deep-dive

### 3.1 Execution flow — **read** [SRC]
`sdk.py` → `Jarvis.ask_full(query: str, agent=None, tools=None, ...)`:
1. `_ensure_engine()` discovers an engine and wraps it in **security guardrails** (`security.setup_security`) and then an **InstrumentedEngine** (telemetry/energy).
2. Model resolved by the router (`learning`) if not given.
3. With no agent: direct `engine.generate()`, with optional memory-context injection (`agent.context_from_memory`, **default `True`**, `core/config.py:1141`).
4. With an agent: `_run_agent()` → `BaseAgent.run()` → tool loop through `ToolExecutor`.
5. Returns `{content, usage, tool_results}`.

Long-running path: `server/agent_manager_routes.py`. Agents are created via `POST /` and fed tasks with `POST /{agent_id}/tasks {description: str}` or messages with `POST /{agent_id}/messages {content: str}`. `AgentExecutor` runs ticks with `_MAX_RETRIES = 3` and error classification (`agents/errors.py`). Tasks carry `status`, `progress` and `findings`.

**Contract observation:** every entry point takes **free text** (`query`, `description`, `content`). There is no structured request carrying objective, constraints, permissions or expected output.

### 3.2 Agents — skimmed [SRC]
`agents/_stubs.py`: `BaseAgent(engine, model, capability_policy, rate_limiter, ...)`, `AgentContext{conversation, tools, memory_results, metadata}`, `AgentResult{content, tool_results, turns, metadata}`. Registered with `@AgentRegistry.register`. The built-ins listed in the README all exist in `agents/`.

### 3.3 Tools & confirmation — read [SRC]
- `tools/_stubs.py`: `ToolSpec.requires_confirmation: bool`. `ToolExecutor.execute()` (l.400–418): if a tool needs confirmation and there is **no interactive callback**, it **refuses** (fail-closed).
- `tools/approval_store.py`: a separate SQLite approval queue for *proactive* agents. It has tiers `trivial/low/medium/high` and **remembered decisions** (`always_approve` / `always_deny`). It is exposed via `GET /v1/approvals/pending` and `POST /v1/approvals/{id}/approve|deny`.
- `security/capabilities.py`: RBAC capabilities `file:read|write`, `network:fetch`, `code:execute`, `memory:read|write`, `channel:send`, `tool:invoke`, `schedule:create`, `system:admin`, granted per agent with glob patterns.

### 3.4 Calendar — read [SRC]
- `connectors/gcalendar.py`: `_GCAL_SCOPE = calendar.readonly` (l.34). It can sync events into the local store and **accept/decline** invites (`events.patch`). It exposes 3 MCP tools: `calendar_get_events_today`, `calendar_search_events`, `calendar_next_meeting`. **There is no event creation.**
- `connectors/oauth.py:63`: the unified Google OAuth requests the full `https://www.googleapis.com/auth/calendar` scope (read+write), which is broader than the features use.
- `tools/apple_calendar.py`: upcoming/search only, macOS only.
- Tokens are stored as JSON files with `0o600` permissions (`connectors/oauth.py:260`). Storage is single-user and on the host filesystem.

### 3.5 Inference engines / model abstraction — read (cloud + DeepSeek path) [SRC]
- `engine/_stubs.py`: `InferenceEngine` ABC with `generate / stream / list_models / health`. Registry-based discovery with fallback.
- `engine/cloud.py`: one class covering many clouds, routed by **model-name prefix** (`_is_deepseek_model = startswith("deepseek")`).
- **DeepSeek path (`_generate_deepseek`)**: builds `create_kwargs` from `model, messages, max_tokens, temperature` only. **`**kwargs` (which carries `tools`) is not forwarded.** The OpenAI path does forward it (`**kwargs` spread). Thinking mode is not disabled and `reasoning_content` is not round-tripped. The catalog lists `deepseek-v4-flash` / `deepseek-v4-pro`, while DeepSeek's current docs list `deepseek-flash` / `deepseek-v4-pro`.
  - **[INF]** Jarvis agents running on DeepSeek most likely **cannot call tools**. Not runtime-tested.

### 3.6 Server / API surface — read [SRC]
- About 100 routes. They include `POST /v1/chat/completions` (OpenAI-compatible), `WS /v1/chat/stream`, agent manager, approvals, connectors (OAuth start/callback/sync), channels, webhooks, research, analytics.
- Auth (`server/auth_middleware.py`): a **single static bearer key** (`OPENJARVIS_API_KEY`, `oj_sk_…`) on `/v1/*`, `/api/*`, `/metrics`, `/docs`. `/health` and webhooks are exempt. The server refuses a non-loopback bind without a key (`check_bind_safety`). Default bind is `127.0.0.1:8000` (`core/config.py:1165`).
- **There is no per-user identity.** One install equals one user.

### 3.7 MCP — skimmed [SRC]
`mcp/client.py`, `server.py`, `transport.py` (stdio + in-process), and `tools/mcp_adapter.py`. Jarvis can both **consume** external MCP servers and **expose** its tools as MCP.

### 3.8 A2A — read [SRC]
`a2a/protocol.py`: Google A2A (JSON-RPC 2.0) with `TaskState` (`submitted, working, input-required, completed, canceled, failed`), `AgentCard` and `A2ATask`. `a2a/server.py` handles `tasks/send|get|cancel`. **It is not referenced by `server/` or `cli/`**, so it is not reachable over HTTP. There is no artifact type.

### 3.9 Memory & persona — skimmed [SRC]
- `memory/service.py`: a background **fact extraction** from every user/assistant exchange, enabled via `[memory]` config. **[INF]** The default value is not confirmed: the code reads `getattr(mem, "enabled", False)`.
- `prompt/builder.py`: injects **SOUL / MEMORY / USER** persona files into prompts. `tools/user_profile_manage.py` maintains `~/.openjarvis/USER.md`.
- `tools/storage/`: SQLite-FTS5 (default), FAISS, ColBERT, BM25, hybrid, knowledge graph. These are memory backends that moved from `memory/`, and the docs still describe the old layout.

### 3.10 Scheduler — skimmed [SRC]
`scheduler/`: cron/interval/once, SQLite persistence and run logs, exposed as MCP tools (`schedule_task`, …). This is the *agent* scheduler, not a calendar.

### 3.11 Learning / tracing — skimmed [SRC][DOC]
Every interaction can produce a `Trace` (SQLite). Router policies (heuristic, trace-driven, SFT/GRPO stubs) plus DSPy/GEPA skill optimisation.

### 3.12 Telemetry / analytics — read [SRC]
- Local telemetry (`telemetry/`, `~/.openjarvis/telemetry.db`) stays on the machine.
- **External analytics (PostHog) is ON by default** (`core/config.py:1223`, `enabled: bool = True`). It sends to `https://34.231.106.201.sslip.io` with an embedded project key. Opt-out is `[analytics] enabled = false`. `DO_NOT_TRACK` is **not** honoured (only `cfg.enabled` is checked, `analytics/identity.py:47`). **[DOC]** It claims to send no chat content and no IP. The frontend also bundles `posthog-js`.

### 3.13 Mining — skimmed [SRC][DOC]
`mining/`: Pearl proof-of-useful-work crypto mining that piggybacks on vLLM inference. It is opt-in (needs a `[mining]` config with a wallet and an H100/H200 for v1). The design doc plans a **20% OpenJarvis fee** in v2 (`MiningConfig.fee_bps`, `docs/design/2026-05-05-vllm-pearl-mining-integration-design.md`).

### 3.14 Rust extension — read [SRC]
`_rust_bridge.py`: "The Rust backend is mandatory … there is no Python fallback." It is used by security scanners, rate limiter, SSRF guard, file/shell/http/git tools, calculator and SQLite/BM25 storage. The host needs a Rust toolchain build (the installer does it in the background). The crates declare **no `license` field** in `Cargo.toml`.

### 3.15 UI — not inspected beyond `package.json`
React 19 + Vite + Tailwind + Tauri 2 desktop/mobile shell.

---

## 4. Dependencies & licenses

Licenses below are from my knowledge of these packages (**[INF]**). They were **not** read from installed package metadata, because nothing was installed. Verify them before any redistribution.

| Dependency | Where | License | Note |
|---|---|---|---|
| click, httpx, websockets, nvidia-ml-py | core | BSD-3 | OK |
| croniter, ddgs, rich, tomlkit, posthog | core | MIT | posthog sends usage data externally (§3.12) |
| openai, datasets | core | Apache-2.0 | OK |
| **python-telegram-bot** | **core** (not optional) | **LGPL-3.0** | Weak copyleft. Fine for unmodified use; obligations apply if modified and redistributed. Odd as a core dependency. |
| **@anthropic-ai/claude-agent-sdk** 0.3.237 | bundled `claude_code_runner` | **Anthropic commercial terms (not OSI)** | Only if the Claude Code agent is used |
| **@whiskeysockets/baileys** | bundled WhatsApp bridge | MIT | **Unofficial WhatsApp protocol**: account-ban / ToS risk |
| litellm (pinned 1.103.0) | optional | MIT | Pinned for a past supply-chain incident (pyproject comment) |
| vllm, kokoro, faster-whisper, playwright, faiss, colbert-ai, torch | optional | Apache/MIT/BSD | OK |
| Rust crates (331 locked packages) | mandatory | not audited | Needs `cargo-deny`/`cargo-about` before integration |
| Frontend (React, Tauri, shadcn, posthog-js, …) | UI | mostly MIT | Not audited |

---

## 5. Component classification (for LUNA)

| Component | Class | Reason |
|---|---|---|
| Agent runtime (`agents/`, `AgentManager`, `AgentExecutor`, retries) | **WRAP** | This is the "HOW" layer Stage 1 delegates to. Reach it through the adapter only. |
| Tool system + `ToolExecutor` + capabilities RBAC | **WRAP** | Execution-side permissions. LUNA passes permissions in; Jarvis enforces them. |
| Approval store / `/v1/approvals` | **INVESTIGATE** | Overlaps LUNA's confirmation ownership. `always_approve` memory conflicts with LUNA's explicit-confirmation rule. |
| Google Calendar connector | **ADAPT** | Read-only. Option B (add create-event) means extending it (§6 F1). |
| MCP client/server | **WRAP / INVESTIGATE** | Useful execution capability. MCP ownership is a future-stage item. |
| A2A protocol | **INVESTIGATE** | Closest existing match to LUNA's Execution Request/Result, but not wired and has no artifacts. |
| Server HTTP API (agent manager, chat completions) | **WRAP** | The realistic transport for a Jarvis adapter (§6 F2) |
| Engine layer / cloud DeepSeek path | **INVESTIGATE** | Tool calls appear to be dropped for DeepSeek (§3.5) |
| Memory service, SOUL/USER persona, context injection | **IGNORE (disable for LUNA use)** | Overlaps LUNA ownership (ADR-001/007/008), see F3 |
| Channels (WhatsApp/Telegram/…), speech, frontend/desktop | **IGNORE** | LUNA owns the user relationship; voice/mobile are out of Stage 1 scope |
| Scheduler | **IGNORE (Stage 1)** | Scheduler/automation is out of scope |
| Learning / traces / evals / bench | **IGNORE (Stage 1)** | Research tooling. Traces may later serve as "evidence". |
| PostHog analytics | **IGNORE + disable** | External data egress, on by default |
| Mining | **IGNORE** | Unrelated to LUNA; crypto/fee implications |
| Security scanners (injection, SSRF, secrets) | **KEEP (as part of Jarvis)** | Valuable and comes with the runtime. Do not reimplement. |

---

## 6. Architecture findings (decision protocol)

### F1 — Jarvis cannot create calendar events
1. **Finding:** Google Calendar support is read-only (+ accept/decline).
2. **Evidence:** `connectors/gcalendar.py` l.34 (`calendar.readonly`), l.487+ (3 read tools). `tools/apple_calendar.py` (read, macOS).
3. **Impact:** LUNA V0.1's only working capability (create event) cannot be delegated to Jarvis as-is.
4. **Options:** A) keep calendar in LUNA as a native adapter; B) add create-event to Jarvis; C) Jarvis plus an external Calendar MCP server.
5. **Decision taken (2026-10-07):** **B**, deferred, not implemented.
6. **Stage 1 change needed:** No, but B depends on F2 (hosting) and F4 (DeepSeek tool calls).

### F2 — Jarvis cannot run inside LUNA's backend
1. **Finding:** Jarvis is a Python + mandatory Rust, local-first, single-user process. LUNA's backend is Supabase Edge Functions (Deno, serverless).
2. **Evidence:** `pyproject.toml`, `_rust_bridge.py`, `core/config.py:1165` (bind 127.0.0.1), `server/auth_middleware.py`.
3. **Impact:** the Jarvis adapter must call Jarvis **over HTTP** on a separate always-on host (Nanda's PC or a VPS). That host must be reachable from Supabase, so it needs a public URL/tunnel, an API key and TLS.
4. **Options:** VPS / home PC + tunnel (e.g. Cloudflare Tunnel) / defer hosting and test the adapter against a local Jarvis only.
5. **Recommendation:** Stage 1 builds and tests the adapter against a **mocked** Jarvis HTTP API, and does not decide hosting yet.
6. **Stage 1 change needed:** No, but hosting is an open question (§8).

### F3 — Jarvis is itself a "center", which overlaps LUNA's ownership
1. **Finding:** Jarvis has its own persona (SOUL), user profile (USER.md), memory with automatic fact extraction, memory-context injection (default on), channels and voice.
2. **Evidence:** `prompt/builder.py:92`, `tools/user_profile_manage.py`, `memory/service.py`, `core/config.py:1141`.
3. **Impact:** context LUNA sends to Jarvis may be **persisted and reused by Jarvis** as its own memory of the user. This conflicts with ADR-001/007 (LUNA owns identity/context) and ADR-008 (execution must not accumulate LUNA memory).
4. **Options:** a) run Jarvis with memory, persona and context injection disabled; b) accept duplicated memory; c) patch Jarvis.
5. **Recommendation:** (a). Treat this as a hard configuration requirement of the Jarvis adapter, and verify it at runtime before real use.
6. **Stage 1 change needed:** No, but it should be recorded as an adapter invariant.

### F4 — DeepSeek tool calling appears broken inside Jarvis
1. **Finding:** `_generate_deepseek` does not forward `tools`.
2. **Evidence:** `engine/cloud.py`, `_generate_deepseek` vs `_generate_openai` (`**kwargs` spread only in the latter).
3. **Impact:** Jarvis agents running on DeepSeek likely cannot execute any tool, including a future create-event tool (Option B). **[INF]** Not runtime-tested.
4. **Options:** fix upstream (small PR); use a different model in Jarvis; route DeepSeek via OpenRouter/LiteLLM paths (these may forward tools, not verified).
5. **Recommendation:** verify with a runtime test before relying on it. If confirmed, a small upstream PR.
6. **Stage 1 change needed:** No.

### F5 — Jarvis' request contract is free text; LUNA's must be structured
1. **Finding:** all Jarvis entry points accept a free-text query/description. A2A is task-shaped but not wired.
2. **Evidence:** `sdk.py:271`, `server/agent_manager_routes.py:95,112`, `a2a/`.
3. **Impact:** the Jarvis adapter must **serialize** LUNA's structured Execution Request into text plus a tool allow-list, and **parse** the results back. Evidence, artifacts and actions taken must be derived from `tool_results`, task `findings` and traces.
4. **Recommendation:** keep LUNA's contract structured and engine-agnostic (Stage 1 decision 4/5). The lossy mapping lives only in the adapter.
5. **Stage 1 change needed:** No. This confirms the Execution Interface design.

### F6 — Confirmation ownership overlap
1. **Finding:** Jarvis has its own confirmation (interactive callback, fail-closed over HTTP) and an approval queue with remembered "always approve" decisions.
2. **Evidence:** `tools/_stubs.py:400–418`, `tools/approval_store.py`.
3. **Impact:** LUNA owns permissions (decision 9) and requires explicit confirmation per action. A Jarvis tool marked `requires_confirmation` **will refuse** when called through the HTTP adapter. A tool without it runs without Jarvis asking anyone.
4. **Recommendation:** LUNA confirms with the user *before* delegating and passes the granted permission in the request. The Jarvis-side tool must not auto-remember approvals.
5. **Stage 1 change needed:** No. This informs Option B's design.

### F7 — External data egress by default
1. **Finding:** PostHog analytics is on by default and `DO_NOT_TRACK` is not honoured.
2. **Evidence:** `core/config.py:1223–1225`, `analytics/identity.py:47`.
3. **Recommendation:** any Jarvis deployment used by LUNA sets `[analytics] enabled = false`.

---

## 7. Docs vs source discrepancies
- `docs/architecture/overview.md` lists `memory/sqlite.py`, `faiss_backend.py`, etc. Those now live in `tools/storage/`, and `memory/` holds the fact-extraction service. This is a reorganisation, not a contradiction of capability.
- README: "the Rust extension … continue[s] downloading in the background". Source: Rust is **mandatory** for core security/tools (`_rust_bridge.py`).
- README/marketing implies calendar integration. Source: read-only.

---

## 8. Name disambiguation (web research, 2026-10-07)

An earlier hypothesis was that "Jarvis" comes in three tiers: OpenJarvis = fundamentals, "Jarvis Assistant" = tools, "Jarvis Institute" = ready-made apps. **Web research does not support this.**

| Name | What it actually is | Related to OpenJarvis? |
|---|---|---|
| **OpenJarvis** (`github.com/open-jarvis`) | Stanford open-source framework (Apache-2.0). The org has only 2 repos: `OpenJarvis` and `website`. Tools, agents, apps (presets) and desktop all live **inside this one repo**. | — |
| **jarvis.institute** — product name "Jarvis AI Assistant" | **Closed-source** Windows desktop app ($9.99 one-time) by an individual (Adrees Umer). It has 75+ tools, voice, Google Calendar/Gmail, and BYO LLM keys. | No affiliation stated. Separate product. |
| getjarvis.eu, openjarvis.org (`alpsencer/openjarvis-lite`), Leon, Microsoft JARVIS/HuggingGPT, sukeesh/Jarvis | Unrelated projects sharing the name | No |

"Jarvis Assistant" and "Jarvis Institute" are most likely the **same** product (product name vs domain). **[INF]** Absence of an affiliation statement is not proof of non-affiliation. jarvis.institute cannot be an execution layer for LUNA: it is closed source, cannot be inspected (ADR-009), cannot be forked (Option B) and is Windows-only.

Sources: github.com/open-jarvis, openjarvis.stanford.edu, scalingintelligence.stanford.edu/blogs/openjarvis, jarvis.institute, getjarvis.eu/jarvis-github, openjarvis.org.

---

## 9. Unresolved questions (for Nanda)

Questions 1–4 are tracked as deferred decisions D-01…D-04 in `docs/DECISIONS.md`.

1. Where will Jarvis run (PC vs VPS), and how will Supabase reach it securely? (F2)
2. Option B implementation path: a fork we maintain, or an upstream PR? Apache-2.0 allows both.
3. Which model will Jarvis itself use? DeepSeek inside Jarvis currently appears unable to call tools (F4).
4. Is it acceptable to run Jarvis with memory, persona and context injection disabled? (F3)
5. Should LUNA's Execution Result "evidence" come from Jarvis traces, tool results, or both?
