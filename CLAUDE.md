# LUNA V0.1 — project rules for Claude Code

## Goal (only this)
User speaks -> STT -> LLM extracts calendar intent -> app asks user to confirm -> backend creates Google Calendar event -> confirmation.

## Hard rules
- Never put API keys / OAuth secrets in the Android app. Server-side only (Supabase Edge Functions).
- LLM never calls Google directly. LLM proposes structured args; backend validates; only then execute after explicit user confirmation.
- Only one tool: `create_google_calendar_event`.
- LLM provider must stay swappable (see supabase/functions/_shared/llm). No provider-specific code outside that folder.
- Timezone is configurable (DEFAULT_TIMEZONE, default Asia/Jakarta). Always inject current datetime + timezone into the LLM prompt.
- Keep it simple. No microservices, no multi-agent, no long-term memory, no vector DB.

## NOT in V0.1
Long-term memory, WhatsApp, Discord, calls, maps, Bluetooth, proactive/background actions, financial integrations.

## Working style
- Explain trade-offs before big changes. Ask before anything irreversible.
- Smallest working step first, then iterate.
