# LUNA

Nanda's personal AI. LUNA is the center: it owns identity, context, intent and delegation. Execution is delegated to an execution layer (currently planned: [OpenJarvis](https://github.com/open-jarvis/OpenJarvis)) through an engine-agnostic Execution Interface. Results flow back to LUNA.

Current state: a V0.1 backend (partly deployed, not yet verified end-to-end) ("Luna, schedule this for me" → Google Calendar) plus **Stage 1**, which builds the execution boundary and Jarvis reconnaissance. See `CLAUDE.md` for the rules.

## Docs
- `CLAUDE.md` — permanent project rules (architecture boundaries, safety, workflow)
- `STAGE_1/CLAUDE_STAGE_1.md` — active stage instructions; `STAGE_1/IMPLEMENTATION_SCOPE.md` — scope and stop conditions
- `docs/architecture/ARCHITECTURE.md` — target architecture (LUNA ↔ execution layer)
- `docs/architecture/JARVIS_REPOSITORY_RECON_STAGE_1.md` — OpenJarvis source reconnaissance
- `docs/DECISIONS.md` — decision log (accepted and deferred)
- `docs/architecture/CURRENT_LUNA_ARCHITECTURE.md` — map of the current LUNA system (Stage 1, Deliverable 1)

## Layout
- `supabase/` — migrations + Edge Functions (Deno/TypeScript): LLM intent, validation, Google Calendar
- `android-app/` — Kotlin + Jetpack Compose client (paused during Stage 1; see its README)
- `docs/`, `STAGE_1/` — documentation and stage instructions

## Backend setup (Supabase)
Prerequisites: Supabase CLI (logged in), Deno (for `deno check` / tests).
1. `supabase link --project-ref <ref>` (the repo already has `supabase/config.toml`), then `supabase db push`.
2. Copy `.env.example` to `supabase/functions/.env` and fill it in (it is gitignored). Then run `supabase secrets set --env-file supabase/functions/.env`.
3. Deploy: `supabase functions deploy luna-intent luna-execute auth-google-exchange --use-api`.
4. Tests: `cd supabase/functions && deno test`.
5. Type-check locally: `cd supabase/functions && deno check luna-intent/index.ts luna-execute/index.ts auth-google-exchange/index.ts`.
