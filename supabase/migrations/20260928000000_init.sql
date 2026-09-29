-- LUNA V0.1 minimal schema
create table public.user_google_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,
  updated_at timestamptz not null default now()
);

create table public.conversation_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.conversation_turns (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.conversation_sessions(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create table public.calendar_events_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  google_event_id text,
  title text not null,
  start_datetime timestamptz not null,
  end_datetime timestamptz not null,
  status text not null check (status in ('pending_confirmation','confirmed','failed')),
  error text,
  created_at timestamptz not null default now()
);

alter table public.user_google_tokens enable row level security;
alter table public.conversation_sessions enable row level security;
alter table public.conversation_turns enable row level security;
alter table public.calendar_events_log enable row level security;

-- user_google_tokens: NO policies on purpose -> only the service role (Edge Functions) can read/write it.

create policy "own sessions" on public.conversation_sessions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own turns" on public.conversation_turns
  for all using (exists (select 1 from public.conversation_sessions s
                         where s.id = session_id and s.user_id = auth.uid()))
  with check (exists (select 1 from public.conversation_sessions s
                      where s.id = session_id and s.user_id = auth.uid()));

create policy "read own event log" on public.calendar_events_log
  for select using (user_id = auth.uid());
