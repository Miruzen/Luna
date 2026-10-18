# Stage 3 Progress — Handoff for Nanda

Keep this file short and update it at the end of each meaningful session. History is at the bottom (newest first), so work can be backtracked or redone. Plan: `STAGE_3_PLAN.md`.

## Current status
Stage 3 started 2026-10-18. Active phase: **3.1 — LUNA Readiness**. Stage 3.2 (real Jarvis integration) has not started.

## Discrepancies found (plan vs. repository)
- **Login is not Google OAuth.** The web app signs in with Supabase email + password (`web/src/components/Login.tsx`). Google OAuth is only used for "Connect Google" (calendar access, `web/src/lib/google.ts` → `auth-google-exchange`). The plan's "Google OAuth/login" check covers both flows.
- Stage 3.2 "one GitHub repository with separate LUNA and Jarvis directories": LUNA stays at the repo root (`supabase/`, `web/`, …); Jarvis would be added as `jarvis/` (ADR-014). Moving LUNA into its own folder would require reconfiguring the Supabase CLI and Vercel paths, so it is not proposed.

## Stage 3.1 inspection (2026-10-18)
Verified:
- Supabase project `Luna` (ap-northeast-2) is ACTIVE_HEALTHY. All 4 Edge Functions are deployed (`luna-intent` v10, `luna-execute` v8, `auth-google-exchange` v3, `luna-cancel` v1, all from 2026-10-15). Local changes since then are comments only.
- Backend tests: 72 passed, 0 failed. Web `npm run build` (type-check + bundle) OK. Bundle scanned: no service-role key, secret key, OpenRouter key or Google client secret.
- `luna-execute` executes only server-stored args, enforces the 15-min TTL, replays completed results, and recovers stale dispatches.

Findings:
- **F3.1-1 (UI, violates gate 5):** after a *retryable* failure (`google_reauth_required`, `calendar_error`, `in_progress`) the confirm card becomes "Diproses" with no buttons (`web/src/components/Chat.tsx:67`). The user cannot retry, although the backend supports it, and "Diproses" reads like success.
- **F3.1-2 (UI):** the history panel shows raw error codes (`calendar_error`) instead of readable text (`History.tsx:67`).
- **F3.1-3 (security, unverified):** `config.toml` has `enable_signup = true`. If the hosted project has the same setting, anyone with the public web URL could create an account and use LUNA (LLM quota, own calendar). The dashboard setting cannot be read from here.
- **F3.1-4 (security advisor):** `public.rls_auto_enable()` is a SECURITY DEFINER function callable by `anon`/`authenticated`. It is not in our migrations (probably created by Supabase). Needs a look before revoking. Other notices: `user_google_tokens` has RLS without policies (intended: service-role only); leaked-password protection is off.
- **F3.1-5:** OI-7 (multi-turn date confusion) sits inside the flow that gate 3 requires to work. Proposed in scope.
- **F3.1-6:** no setup doc for `web/`; the README covers the backend only.

## Proposed Stage 3.1 tasks (awaiting Nanda's approval)
| # | Task | Who |
|---|---|---|
| T1 | `web/README.md`: local setup and run steps; root README points to it | Claude |
| T2 | Config check: CORS preflight from `http://localhost:5173` against the live functions; Google redirect URI added | Claude (CORS) + Nanda (Google Console) |
| T3 | Fix F3.1-1/F3.1-2: card shows "Gagal" plus a "Coba lagi" button for retryable errors; readable history errors. Pure card-state function with regression tests | Claude |
| T4 | OI-7: annotate explicit dates in code ("1 oktober" → weekday + "sudah lewat"); add multi-turn cases incl. the "iya" flow to `scripts/date-eval.ts` | Claude |
| T5 | Security: Nanda checks the signup setting (disable if on); Claude inspects `rls_auto_enable` and proposes a fix | Nanda + Claude |
| T6 | Manual E2E session with a checklist (happy path, cancel, expiry, Google not connected, double tap, retry); Claude checks `work_items`/`work_item_events` after each case | Nanda (browser) + Claude (DB) |
| T7 | Stage 3.1 acceptance report | Claude |

## Proposed Stage 3.1 acceptance criteria
- AC1: The app starts locally by following `web/README.md` alone.
- AC2: Email/password login works; "Hubungkan Google" completes and stores a token (row in `user_google_tokens`).
- AC3: Happy path: intent → confirm card → "Setuju" → event in Google Calendar → link in the UI → `work_items.status = completed` with matching `work_item_events`.
- AC4: No outward action without approval: no event exists for proposed, cancelled or expired items; a second "Setuju" does not create a second event.
- AC5: The UI never shows success for a failed, incomplete or in-progress action; retryable failures can be retried from the same card.
- AC6: Multi-turn date clarification (OI-7 case) gives correct weekdays and does not propose past dates without saying so.
- AC7: Backend tests pass (72 + new); new regression tests for every bug fixed in 3.1.
- AC8: No secrets in the client bundle or git; signups are closed on the hosted project.

## Decisions needed from Nanda
- Approve the T1–T7 breakdown and AC1–AC8 (or adjust).
- OI-7 in scope for 3.1? (proposed: yes)
- Vercel deploy: part of 3.1 or after it? (proposed: after AC1–AC8 pass locally)
- OI-6 (free model timeouts, 20 s limit): raise to 30 s now, or leave as is? Open items OI-4/OI-5 stay as they are (OI-4 = Stage 3.2).

## Decisions (DEC-3xx)
None yet.

## Exact next action
Nanda approves (or adjusts) the Stage 3.1 breakdown; then Claude starts T1 + T3.

---

## History
- **2026-10-18** — Stage 3 plan received from Nanda. Stage folders reorganised under `Stage/` (`STAGE_1/` → `Stage/stage-1/`, `stage-2/` → `Stage/stage-2/`, new `Stage/stage-3/`); path references in `CLAUDE.md`, `README.md` and code comments updated. Applied migration files left unchanged.
