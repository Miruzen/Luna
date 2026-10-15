# LUNA — Current Architecture Map (Stage 1, Deliverable 1)

Snapshot of what exists **today**, before the Execution Interface is introduced. It is based on the source in this repo and the live Supabase project, checked on 2026-10-13.

Tags: **[SRC]** read in source · **[LIVE]** checked against the Supabase project · **[NOT VERIFIED]** exists but never run end-to-end.

## 1. System overview

```text
Nanda
  │  voice (planned) / any HTTP client today
  ▼
Client app ── android-app/  ── NOT BUILT (README only; paused, out of Stage 1 scope)
  │  Supabase JWT
  ▼
Supabase Edge Functions (Deno/TypeScript) ─ project "Luna" (xqonuxrspwysoksclpiz, ap-northeast-2)
  ├── luna-intent            text → LLM → validated proposal (confirm card) or clarifying question
  ├── luna-execute           confirmed proposal → re-validate → Google Calendar → log
  └── auth-google-exchange   Google serverAuthCode → refresh token (server-side)
  │
  ├── _shared/llm/           provider chain with fallback (OpenRouter → DeepSeek; OpenAI optional)
  ├── _shared/calendar/      validation + Google Calendar/OAuth client
  └── Postgres (RLS)         sessions, turns, Google tokens, event log
  │
  ▼
External: DeepSeek API · Google OAuth · Google Calendar API
```

## 2. Request flow [SRC]

1. **Intent** — `POST luna-intent {text, session_id?}` with the user's Supabase JWT.
   - `requireUser` checks the JWT (`_shared/http.ts`).
   - `resolveSession` / `loadHistory` reuse the session and load the last 10 turns (RLS as the user).
   - `createProvider().extractCalendarIntent(...)` is called with the local datetime + timezone (`_shared/time.ts` `localNow`) and the single tool `create_google_calendar_event`.
   - A tool call goes through `validateEventArgs` (backend is the authority) and returns `{kind:"confirm", confirmation_id, args, summary}`. Plain text returns `{kind:"clarification", question}`.
   - The user and assistant turns are stored.
2. **Confirmation** — happens in the client (Nanda taps confirm). Nothing executes before this.
3. **Execute** — `POST luna-execute {confirmation_id, args, session_id?}`.
   - It re-validates `args` and never trusts the client.
   - It loads the refresh token with the service role.
   - `refreshAccessToken` → `createCalendarEvent(eventId = confirmation_id)`. A retry is idempotent: a 409 makes it fetch the existing event.
   - It records the outcome in `work_items`/`work_item_events` (Stage 2; `calendar_events_log` was dropped 2026-10-15) and an outcome turn, then returns `{ok, event_id, html_link}` or a typed error (`google_not_connected`, `google_reauth_required`, `invalid_args`, `calendar_error`).
4. **Google connect (one-time)** — `POST auth-google-exchange {code}` exchanges the code server-side. It checks that the `calendar.events` scope was granted and upserts `user_google_tokens`.

## 3. Module map and ownership (against the Stage 1 model)

| Module | Responsibility | Stage 1 owner | Note |
|---|---|---|---|
| `luna-intent/index.ts` | Intent capture, session, clarification, proposal | **LUNA** (WHAT/WHY) | Fits Stage 1 |
| `_shared/llm/*` | LLM provider abstraction + fallback chain (OpenRouter → DeepSeek, ADR-016); DeepSeek thinking disabled | **LUNA** (intelligence) | Provider-specific code stays here (rule kept) |
| `_shared/calendar/validate.ts` | Validates proposed args | **LUNA** (constraints) | LUNA-side guard before delegation |
| `_shared/time.ts`, `config.ts`, `types.ts`, `http.ts` | Utilities, config, DTOs, auth helpers | **LUNA** | — |
| Confirmation step (client + `confirmation_id`) | Nanda approves the action | **Nanda → LUNA** (ADR-012) | — |
| `luna-execute/index.ts` | Executes the confirmed action | **Mixed** | Confirmation gate + re-validation are LUNA; the actual Google call is execution (HOW) |
| `_shared/calendar/googleCalendarClient.ts` | Google OAuth refresh + event insert | **Execution layer** (ADR-006) | Today it runs inside LUNA. ADR-011 moves it to Jarvis later (deferred). |
| `auth-google-exchange/index.ts` | Stores Google credentials | **LUNA** (ADR-013) | Credentials stay in Supabase. How they reach Jarvis at execution time is still open (ADR-013 notes). |
| `conversation_sessions/turns` | Short conversation context | **LUNA** (context) | Not long-term memory |
| `work_items`, `work_item_events` | Work-item state + transition audit trail (Stage 2) | **LUNA** (single writer) | Replaced `calendar_events_log` (dropped 2026-10-15) |

## 4. Where the Execution Interface will cut in

```text
TODAY:   luna-execute ── validate ── googleCalendarClient ── Google
STAGE 1: luna-execute ── validate ── ExecutionInterface ──┬── (existing calendar path, unchanged for now)
                                                          └── JarvisAdapter → mocked Jarvis HTTP API (tests only)
```

- Stage 1 adds the contract, interface and adapter **beside** the existing path. It does not reroute the working calendar flow, because ADR-011 is deferred and the completion criteria require that "existing functionality remains intact".
- Whether to route the existing calendar call through the interface now (as a native adapter) is a separate decision. It is not assumed here.

## 5. Data model [SRC] [LIVE: tables exist, RLS on]

| Table | Access | Purpose |
|---|---|---|
| `user_google_tokens` | service role only (RLS, no policies, by design) | Google refresh token per user |
| `conversation_sessions` | own rows (RLS) | Conversation container |
| `conversation_turns` | own sessions (RLS) | user/assistant turns, last 10 loaded |
| `work_items` | user can read own; written by service role | Current state of each proposed/executed action (Stage 2) |
| `work_item_events` | user can read own; written by service role | Append-only transition history (Stage 2) |

## 6. Deployment and verification state

| Item | State |
|---|---|
| DB migration `20260928000000_init` | Applied [LIVE] |
| `luna-intent` | Deployed, v3 (provider chain), `verify_jwt=true` [LIVE] · **end-to-end verified 2026-10-14** via OpenRouter free model (confirm, clarify and follow-up flows correct). Latency after the model reorder: 4.3–7.1 s client-side. Server-side, the LLM takes 2.4–5.9 s (`nvidia/nemotron-3.5-lightning:free`) and DB+auth ~0.6–1.0 s; the rest is network/gateway. Per-stage timings are in the logs and the `Server-Timing` header. |
| `luna-execute`, `auth-google-exchange` | Deployed 2026-10-14 [LIVE] · **end-to-end verified**: Google connected via the dev side door (`scripts/google-connect.ts`), a real event was created from a LUNA confirm card, and a retry with the same `confirmation_id` returned the same event (no duplicate). A retry no longer writes a second log row or turn (fixed and verified 2026-10-14). |
| Secrets | `LLM_PROVIDERS=openrouter,deepseek`, `OPENROUTER_API_KEY`, `OPENROUTER_MODELS` (2 free models), `DEEPSEEK_API_KEY`, `LLM_MODEL=deepseek-flash`, `DEFAULT_TIMEZONE`. `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_ALLOWED_REDIRECT_URIS` set. |
| Google Cloud (OAuth client, Calendar API) | Configured (Web client, Calendar API enabled, app in **Testing** mode: refresh tokens expire after 7 days, so a reconnect is needed weekly until the app is set to In production) |
| Android app | Not created |
| Automated tests | `deno test` in `supabase/functions`: 36 tests (contract, interface, Jarvis adapter with a mocked transport, LLM provider chain/fallback, and regression tests for `validate.ts`/`time.ts`). |

## 7. Conformance with `CLAUDE.md`

| Rule | Status |
|---|---|
| Secrets server-side only | Yes. Keys are only in Edge Function secrets and gitignored `supabase/functions/.env`. |
| LLM only proposes; backend validates | Yes. `validateEventArgs` runs in both `luna-intent` and `luna-execute`. |
| Explicit confirmation per action | Yes, by design (`confirmation_id`). The client that enforces it does not exist yet. |
| Provider-specific code only in `_shared/llm` | Yes |
| Datetime + timezone injected | Yes (`localNow`) |
| LUNA core independent of Jarvis | Yes. There is no Jarvis code or dependency today. |

## 8. Gaps relevant to Stage 1
1. ~~No Execution contract/interface~~ → added in `_shared/execution/` (`contract.ts`, `interface.ts`). It is not yet wired into any Edge Function (Option 1: built beside the existing path).
2. Execution (Google call) is still embedded in `luna-execute`, by decision, until ADR-011.
3. ~~No Jarvis adapter / tests~~ → `_shared/execution/jarvis/` (adapter + transport interface, **no network transport**: D-01 deferred, Jarvis HTTP agent endpoint shape unverified) and 24 tests.
4. ~~LLM integration not proven~~ → `luna-intent` verified end-to-end on 2026-10-14 (OpenRouter path). The direct DeepSeek path is untested (no balance).
