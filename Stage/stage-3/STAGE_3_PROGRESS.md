# Stage 3 Progress — Handoff for Nanda

Keep this file short and update it at the end of each meaningful session. History is at the bottom (newest first), so work can be backtracked or redone. Plan: `STAGE_3_PLAN.md`.

## Current status
Stage 3 started 2026-10-18. Active phase: **3.1 — LUNA Readiness**. Stage 3.2 (real Jarvis integration) has not started.

## Discrepancies found (plan vs. repository)
- **Login is not Google OAuth.** The web app signs in with Supabase email + password (`web/src/components/Login.tsx`). Google OAuth is only used for "Connect Google" (calendar access, `web/src/lib/google.ts` → `auth-google-exchange`). The plan's "Google OAuth/login" check covers both flows.
- Stage 3.2 "one GitHub repository with separate LUNA and Jarvis directories": LUNA stays at the repo root (`supabase/`, `web/`, …); Jarvis would be added as `jarvis/` (ADR-014). Moving LUNA into its own folder would require reconfiguring the Supabase CLI and Vercel paths, so it is not proposed.

## Decisions needed from Nanda
- Open items OI-4…OI-7 (`docs/OPEN_ITEMS.md`), raised at stage start.
- Approval of the Stage 3.1 task breakdown and acceptance criteria (to be proposed after inspection).

## Decisions (DEC-3xx)
None yet.

## Exact next action
Claude inspects the repository against the plan and proposes the Stage 3.1 task breakdown and acceptance criteria for Nanda's approval.

---

## History
- **2026-10-18** — Stage 3 plan received from Nanda. Stage folders reorganised under `Stage/` (`STAGE_1/` → `Stage/stage-1/`, `stage-2/` → `Stage/stage-2/`, new `Stage/stage-3/`); path references in `CLAUDE.md`, `README.md` and code comments updated. Applied migration files left unchanged.
