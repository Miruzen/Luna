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

## Stage 3.1 tasks (approved 2026-10-26, DEC-301)
| # | Task | Who | Status |
|---|---|---|---|
| T1 | `web/README.md`: local setup and run steps; root README points to it | Claude | Done; AC1 passed on attempt 2 |
| T2 | Config check: CORS preflight from `http://localhost:5173` against the live functions; Google redirect URI added | Claude (CORS) + Nanda (Google Console) | Done |
| T3 | Fix F3.1-1/F3.1-2: card shows "Gagal" plus a "Coba lagi" button for retryable errors; readable history errors. Pure card-state function with regression tests | Claude | Done (code + 15 tests; browser check in T6) |
| T4 | OI-7: annotate explicit dates in code ("1 oktober" → weekday + "sudah lewat"); add multi-turn cases incl. the "iya" flow to `scripts/date-eval.ts` | Claude | Open |
| T5 | Security: Nanda checks the signup setting (disable if on); Claude inspects `rls_auto_enable` and proposes a fix | Nanda + Claude | Signup disabled by Nanda in the dashboard (2026-11-01, reported, not readable from here); `rls_auto_enable` open |
| T6 | Manual E2E session with a checklist (happy path, cancel, expiry, Google not connected, double tap, retry); Claude checks `work_items`/`work_item_events` after each case | Nanda (browser) + Claude (DB) | Open |
| T7 | Stage 3.1 acceptance report | Claude | Open |

## Stage 3.1 acceptance criteria (approved 2026-10-26, DEC-301)
- AC1: The app starts locally by following `web/README.md` alone.
- AC2: Email/password login works; "Hubungkan Google" completes and stores a token (row in `user_google_tokens`).
- AC3: Happy path: intent → confirm card → "Setuju" → event in Google Calendar → link in the UI → `work_items.status = completed` with matching `work_item_events`.
- AC4: No outward action without approval: no event exists for proposed, cancelled or expired items; a second "Setuju" does not create a second event.
- AC5: The UI never shows success for a failed, incomplete or in-progress action; retryable failures can be retried from the same card.
- AC6: Multi-turn date clarification (OI-7 case) gives correct weekdays and does not propose past dates without saying so.
- AC7: Backend tests pass (72 + new); new regression tests for every bug fixed in 3.1.
- AC8: No secrets in the client bundle or git; signups are closed on the hosted project.

## Decisions needed from Nanda
None open.

## Decisions (DEC-3xx)
- **DEC-301 (2026-10-26):** T1–T7 and AC1–AC8 approved as proposed.
- **DEC-302 (2026-10-26):** OI-7 (multi-turn date confusion) is in Stage 3.1 scope (T4, AC6).
- **DEC-303 (2026-10-26):** Vercel deploy happens after AC1–AC8 pass locally, not inside 3.1.
- **DEC-304 (2026-10-26):** OI-6: raise the LLM provider timeout from 20 s to 30 s (still well under the 150 s function limit).
- **DEC-305 (2026-10-26, implementation):** web unit tests run with Deno (`npm test` → `deno test tests/`) instead of adding Vitest; the tested logic lives in import-free `web/src/lib/outcome.ts`. No new npm dependency.
- **DEC-306 (2026-11-01, Nanda):** Stage 3.2 runs Jarvis on Nanda's **local PC** (installed on D:), not a cloud host. Transport stays the Supabase mailbox/pull model (Jarvis polls outbound, so no tunnel or inbound port). Cloud hosting (plan §4, Oracle/Google free tier) is deferred, not cancelled. Rationale (Nanda): LUNA is single-user trial-and-error for now; migrate Jarvis to a cloud host/server when other people start using LUNA. Consequences: Jarvis executes only while the PC is on; the 3.2 gate item "cloud runtime operates while the PC is off" does not apply for now; what LUNA does with an approved request while the PC is off must be designed in 3.2 (open: wait in queue vs time out and fail retryable vs fall back to LUNA's own calendar path). Stage 3.1 is unaffected. Also resolves D-01 for now (`docs/DECISIONS.md`).

## Exact next action
Nanda follows `web/README.md` to start the app (AC1) and retests the confirm card; Claude meanwhile does T4 (OI-7) and the 30 s timeout (DEC-304).

---

## History
- **2026-11-01** — Nanda disabled "Allow new users to sign up" in the Supabase dashboard (T5, part of AC8). T6 manual E2E session started with the checklist below.
- **2026-11-01** — DEC-306: Jarvis will run locally for Stage 3.2 (D-01 resolved for now; OI-4 updated). Supabase checked: ACTIVE_HEALTHY. Stage 3.1 still open at AC4–AC8.
- **2026-10-26** — AC3 passed: Nanda created "Meeting — Sat, 14 Nov 2026, 15:00–16:00" from the web; event visible in Google Calendar; work item `completed`, attempt 1, events proposed→approved→dispatched→completed, `last_result` ok with html_link. An earlier attempt (14:49 UTC, before reconnecting Google) ended `failed` with `google_reauth_required`, retryable: the 7-day Testing-mode token expiry, handled as designed.
- **2026-10-26** — AC1 passed (attempt 2, following the fixed README). T2: Nanda added `http://localhost:5173/google/callback` in Google Cloud Console; the web calls the live functions from localhost:5173 (CORS OK). AC2 passed: "Hubungkan Google" from the web stored a refresh token for luna-test@example.com (`user_google_tokens.updated_at` 2026-10-26 15:14 UTC; checked by presence only, token not read).
- **2026-10-26** — AC1 attempt 1 failed: Nanda ran `npm run dev` from the repo root (ENOENT package.json). Root cause partly in the README: `cd web && npm install` does not work in Windows PowerShell 5.1. `web/README.md` now uses separate lines, a quoted absolute path, and a troubleshooting entry for this error.
- **2026-10-26** — Nanda approved T1–T7 / AC1–AC8 (DEC-301..304). Supabase project checked: ACTIVE_HEALTHY. T3: new `web/src/lib/outcome.ts` (pure `cardStateAfterExecute`, readable error texts/labels); `Chat.tsx` shows "Gagal" + "Coba lagi" for retryable errors and network failures, "✅ Berhasil" on success, "Gagal" for final errors; `History.tsx` shows readable error labels. `web/tests/outcome.test.ts`: 15 passed. `npx tsc -b` OK. T1: `web/README.md` (setup, backend config table, troubleshooting); root README links it and now lists `luna-cancel` in deploy/check commands.
- **2026-10-18** — Stage 3 plan received from Nanda. Stage folders reorganised under `Stage/` (`STAGE_1/` → `Stage/stage-1/`, `stage-2/` → `Stage/stage-2/`, new `Stage/stage-3/`); path references in `CLAUDE.md`, `README.md` and code comments updated. Applied migration files left unchanged.
