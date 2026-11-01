# Stage 3 Progress — Handoff for Nanda

Keep this file short and update it at the end of each meaningful session. History is at the bottom (newest first), so work can be backtracked or redone. Plan: `STAGE_3_PLAN.md`.

## Current status
Stage 3 started 2026-10-18. **Stage 3.1 — LUNA Readiness: all acceptance criteria met (report below, 2026-11-01); awaiting Nanda's formal acceptance.** Stage 3.2 (real Jarvis integration, local PC per DEC-306) has not started.

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
- **F3.1-7 (found in T6 Test B, 2026-11-01):** "tes batal lusa jam 10 pagi" produced a card for the *previous* request ("Test Kedaluwarsa, besok 09:00"). Cause: earlier proposals stay in the LLM history labelled "awaiting user confirmation" and the free model copied one. Safety held (Nanda saw the card and cancelled), but the proposal was wrong.
- **F3.1-8 (Nanda's live test, 2026-11-01):** "seharian" made LUNA ask for a time twice: the event schema required start/end times, so all-day events were impossible. Fixed (DEC-308).
- **F3.1-9 (same test):** "27 Februari 5 tahun kedepan" would have been annotated as 2027 by the new explicit-date code (T4), and dates in an earlier message of the dialogue were not annotated at all. Fixed.
- **F3.1-4 inspected (2026-11-01):** `rls_auto_enable()` is an **event trigger function** (`ensure_rls` on `ddl_command_end`) that turns RLS on for every new table in `public`, i.e. a safety net (Supabase's auto-enable-RLS option). Event trigger functions cannot be called directly (Postgres rejects it), so the `anon`/`authenticated` EXECUTE grant is not exploitable in practice. Proposal: keep the function; revoke EXECUTE from `anon` and `authenticated` in a small migration to clear the advisor warning.

## Stage 3.1 tasks (approved 2026-10-26, DEC-301)
| # | Task | Who | Status |
|---|---|---|---|
| T1 | `web/README.md`: local setup and run steps; root README points to it | Claude | Done; AC1 passed on attempt 2 |
| T2 | Config check: CORS preflight from `http://localhost:5173` against the live functions; Google redirect URI added | Claude (CORS) + Nanda (Google Console) | Done |
| T3 | Fix F3.1-1/F3.1-2: card shows "Gagal" plus a "Coba lagi" button for retryable errors; readable history errors. Pure card-state function with regression tests | Claude | Done (code + 15 tests; browser check in T6) |
| T4 | OI-7: annotate explicit dates in code ("1 oktober" → weekday + "sudah lewat"); add multi-turn cases incl. the "iya" flow to `scripts/date-eval.ts` | Claude | Done, deployed |
| T5 | Security: Nanda checks the signup setting (disable if on); Claude inspects `rls_auto_enable` and proposes a fix | Nanda + Claude | Done: signup disabled (Nanda); revoke migration applied |
| T6 | Manual E2E session with a checklist (happy path, cancel, expiry, Google not connected, double tap, retry); Claude checks `work_items`/`work_item_events` after each case | Nanda (browser) + Claude (DB) | Done (A–E + all-day) |
| T7 | Stage 3.1 acceptance report | Claude | Done (below) |

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
- **DEC-308 (2026-11-01, Nanda chose option A):** support all-day events inside the existing calendar.events.create capability (not a new capability). Shape: optional `all_day: true`; `start_datetime`/`end_datetime` stay, normalized by validation to local midnights (end exclusive), so projection, contract and stored args keep their form. Google receives `start.date`/`end.date`; LUNA's acceptance check compares dates for all-day events. `all_day` added to the projection allowlist so Jarvis (3.2) receives it.
- **DEC-307 (2026-11-01, implementation, open for Nanda to reverse):** fix for F3.1-7: only the open dialogue goes to the LLM (`_shared/history.ts` `openDialogue`); a card, cancel, created or failed turn closes it. Trade-off: a follow-up edit after a card ("ganti jadi jam 4") is no longer understood; LUNA asks for the full request.
- **DEC-301 (2026-10-26):** T1–T7 and AC1–AC8 approved as proposed.
- **DEC-302 (2026-10-26):** OI-7 (multi-turn date confusion) is in Stage 3.1 scope (T4, AC6).
- **DEC-303 (2026-10-26):** Vercel deploy happens after AC1–AC8 pass locally, not inside 3.1.
- **DEC-304 (2026-10-26):** OI-6: raise the LLM provider timeout from 20 s to 30 s (still well under the 150 s function limit).
- **DEC-305 (2026-10-26, implementation):** web unit tests run with Deno (`npm test` → `deno test tests/`) instead of adding Vitest; the tested logic lives in import-free `web/src/lib/outcome.ts`. No new npm dependency.
- **DEC-306 (2026-11-01, Nanda):** Stage 3.2 runs Jarvis on Nanda's **local PC** (installed on D:), not a cloud host. Transport stays the Supabase mailbox/pull model (Jarvis polls outbound, so no tunnel or inbound port). Cloud hosting (plan §4, Oracle/Google free tier) is deferred, not cancelled. Rationale (Nanda): LUNA is single-user trial-and-error for now; migrate Jarvis to a cloud host/server when other people start using LUNA. Consequences: Jarvis executes only while the PC is on; the 3.2 gate item "cloud runtime operates while the PC is off" does not apply for now; what LUNA does with an approved request while the PC is off must be designed in 3.2 (open: wait in queue vs time out and fail retryable vs fall back to LUNA's own calendar path). Stage 3.1 is unaffected. Also resolves D-01 for now (`docs/DECISIONS.md`).

## Stage 3.1 acceptance report (T7, 2026-11-01)
| AC | Evidence | Result |
|---|---|---|
| AC1 start locally from `web/README.md` | Nanda started it following the README (attempt 2, after fixing the PowerShell `&&` / wrong-folder issue in the README) | Pass |
| AC2 login + Connect Google | Email/password login; "Hubungkan Google" stored a refresh token (`user_google_tokens`, presence checked only) | Pass |
| AC3 intent → card → approve → event → link → completed | "Meeting 14 Nov" (2026-10-26) and the all-day "27 Feb 2031" event (2026-11-01): visible in Google Calendar, `completed`, events proposed→approved→dispatched→completed | Pass |
| AC4 no outward action without approval | T6 A (expired: never dispatched), B (cancelled), C (one event, attempt 1); backend replay/idempotency tests | Pass |
| AC5 UI never shows false success; retry possible | T6 D (offline → Gagal + Coba lagi → Berhasil, one event), E (readable history); `web/tests` 15 cases | Pass |
| AC6 multi-turn dates correct, past dates flagged | OI-7 sentence → question; "iya" → Sun 18 Oct 15:00 (3/3); Test B re-proposal fixed; "27 Februari 5 tahun kedepan" → 2031 | Pass (free-model flakiness remains, see limitations) |
| AC7 tests pass + regression tests | Backend 72 → 90 passed, web 15 passed, `deno check` + `tsc -b` OK; new tests for F3.1-1/2/7/8/9 and OI-7 | Pass |
| AC8 no secrets in client/git; signups closed | Bundle scan: only supabase-js prefix checks, no key values; no `.env` files tracked; signups disabled by Nanda; `rls_auto_enable` EXECUTE revoked, advisor clear (2 intended notices) | Pass |

Known limitations carried forward:
- Free OpenRouter models: occasional timeouts even at 30 s (3 of 15 in the last eval) and ~50 requests/day; DeepSeek fallback unfunded (OI-6 stays open).
- Google OAuth app in Testing mode: reconnect every 7 days; Supabase free project pauses after ~7 idle days (OI-5).
- DEC-307: a follow-up edit after a card ("ganti jadi jam 4") is not understood; LUNA asks for the full request.
- Not deployed to Vercel yet (DEC-303: after 3.1).
- Signup setting verified by Nanda only (not readable via the tools used here).

## T6 manual E2E results (2026-11-01, Nanda in the browser, Claude checked the DB)
| Test | Browser | DB | Result |
|---|---|---|---|
| A expired | "kedaluwarsa", card Gagal, no event | proposed→expired, attempt 0 | Pass (AC4) |
| B cancel | "dibatalkan", no event | proposed→cancelled | Pass (AC4); exposed F3.1-7 |
| C double tap | one event; the button disappears after one click | 1 item, attempt 1, completed | Pass (AC4) |
| D offline → Coba lagi | Gagal + Coba lagi, then Berhasil, one event | completed at attempt 1 (offline request never reached the server) | Pass (AC5, AC4) |
| E history | statuses and readable errors | n/a | Pass (AC5) |
| All-day retest | card "Thu, 27 Feb 2031 (all day)", all-day event with the note in GCal | `all_day` true, 2031-02-27 → 2031-02-28 (exclusive), description set, completed, acceptance passed | Pass (F3.1-8/9) |

## Exact next action
Nanda formally accepts Stage 3.1; then Claude starts Stage 3.2 with the OpenJarvis source inspection (dependencies, runtime on Windows/D:, license, tool calling) and proposes the 3.2 task breakdown and acceptance criteria.

---

## History
- **2026-11-01** — All-day retest passed (Nanda + DB). T7 acceptance report written: AC1–AC8 pass. Web bundle rebuilt and scanned for secrets (clean).
- **2026-11-01** — Deployed `luna-intent` + `luna-execute` with all-day support (DEC-308) on Nanda's go. Waiting for Nanda's browser retest.
- **2026-11-01** — Deployed `luna-intent` (T4) and applied migration `20261101000000_revoke_rls_auto_enable_execute` (EXECUTE now only postgres + service_role; advisor warning gone; remaining notices: `user_google_tokens` RLS without policies = intended, leaked-password protection off = moot with signups closed). F3.1-8/9 from Nanda's live test fixed (DEC-308): all-day in types/validate/Google client/acceptance/policy/tool schema/summary (`formatAllDay`), notes go to description, relative years ("5 tahun kedepan", "tahun depan", "dua tahun lagi"), open-dialogue user turns annotated too, prompt rule so a confirmed date ("iya") is not questioned again. Tests: 90 passed. Live eval 11/15: both new all-day cases OK; 3 OpenRouter timeouts at 30 s (OI-6, not logic); "iya" failed once, fixed by the prompt rule, rerun 3/3 OK. Not deployed yet (needs Nanda's go: `luna-intent` + `luna-execute`).
- **2026-11-01** — T6 manual E2E A–E passed (table above); F3.1-7 found. T4 implemented: `annotateExplicitDates` in `_shared/time.ts` (weekday + "sudah lewat" + next-year date, by code), `openDialogue` in new `_shared/history.ts` (DEC-307), prompt rules (trust LUNA's computed dates; ask when the weekday does not match or the date has passed; build events only from the current request), provider timeout 20 s → 30 s (DEC-304). Tests: 81 passed (72 + 9 new). `deno check` on all 4 functions OK. `scripts/date-eval.ts` gained 3 multi-turn/OI-7 cases; live run 12/13: all new cases OK; "rabu minggu depan" asked a confirmation once (rerun 3×: 2 scheduled correctly, 1 asked with the correct date) = free-model flakiness, safe direction. F3.1-4 inspected (see Findings). Not deployed yet.
- **2026-11-01** — Nanda disabled "Allow new users to sign up" in the Supabase dashboard (T5, part of AC8). T6 manual E2E session started with the checklist below.
- **2026-11-01** — DEC-306: Jarvis will run locally for Stage 3.2 (D-01 resolved for now; OI-4 updated). Supabase checked: ACTIVE_HEALTHY. Stage 3.1 still open at AC4–AC8.
- **2026-10-26** — AC3 passed: Nanda created "Meeting — Sat, 14 Nov 2026, 15:00–16:00" from the web; event visible in Google Calendar; work item `completed`, attempt 1, events proposed→approved→dispatched→completed, `last_result` ok with html_link. An earlier attempt (14:49 UTC, before reconnecting Google) ended `failed` with `google_reauth_required`, retryable: the 7-day Testing-mode token expiry, handled as designed.
- **2026-10-26** — AC1 passed (attempt 2, following the fixed README). T2: Nanda added `http://localhost:5173/google/callback` in Google Cloud Console; the web calls the live functions from localhost:5173 (CORS OK). AC2 passed: "Hubungkan Google" from the web stored a refresh token for luna-test@example.com (`user_google_tokens.updated_at` 2026-10-26 15:14 UTC; checked by presence only, token not read).
- **2026-10-26** — AC1 attempt 1 failed: Nanda ran `npm run dev` from the repo root (ENOENT package.json). Root cause partly in the README: `cd web && npm install` does not work in Windows PowerShell 5.1. `web/README.md` now uses separate lines, a quoted absolute path, and a troubleshooting entry for this error.
- **2026-10-26** — Nanda approved T1–T7 / AC1–AC8 (DEC-301..304). Supabase project checked: ACTIVE_HEALTHY. T3: new `web/src/lib/outcome.ts` (pure `cardStateAfterExecute`, readable error texts/labels); `Chat.tsx` shows "Gagal" + "Coba lagi" for retryable errors and network failures, "✅ Berhasil" on success, "Gagal" for final errors; `History.tsx` shows readable error labels. `web/tests/outcome.test.ts`: 15 passed. `npx tsc -b` OK. T1: `web/README.md` (setup, backend config table, troubleshooting); root README links it and now lists `luna-cancel` in deploy/check commands.
- **2026-10-18** — Stage 3 plan received from Nanda. Stage folders reorganised under `Stage/` (`STAGE_1/` → `Stage/stage-1/`, `stage-2/` → `Stage/stage-2/`, new `Stage/stage-3/`); path references in `CLAUDE.md`, `README.md` and code comments updated. Applied migration files left unchanged.
