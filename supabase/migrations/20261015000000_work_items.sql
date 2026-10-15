-- Stage 2, Workstream 1: shared operational state for delegated work.
-- Design: stage-2/docs/STATE_OWNERSHIP.md. LUNA's backend (service role) is the only writer;
-- users can read their own rows. Transitions are validated in _shared/state/workItem.ts.

create table public.work_items (
  -- = confirmation_id = ExecutionRequest.request_id = engine idempotency key (Google event id)
  id text primary key check (id ~ '^[0-9a-v]{5,1024}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.conversation_sessions(id) on delete set null,
  capability text not null,                 -- e.g. 'calendar.events.create'
  status text not null check (status in (
    'proposed','approved','dispatched','needs_approval','needs_input',
    'completed','failed','rejected','cancelled','expired')),
  attempt integer not null default 0 check (attempt >= 0),
  args jsonb not null,                      -- exactly what Nanda was shown and approved
  summary text,
  last_result jsonb,                        -- latest engine outcome (errors, retryable, event id, ...)
  expires_at timestamptz not null,          -- proposal TTL; only meaningful while 'proposed'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index work_items_user_id_idx on public.work_items (user_id);
create index work_items_session_id_idx on public.work_items (session_id);

-- Append-only audit trail of every transition (and refused/stale ones), to backtrack.
create table public.work_item_events (
  id bigint generated always as identity primary key,
  work_item_id text not null references public.work_items(id) on delete cascade,
  from_status text,
  to_status text not null,
  actor text not null check (actor in ('nanda','luna','engine')),
  attempt integer not null,
  note text,
  created_at timestamptz not null default now()
);
create index work_item_events_work_item_id_idx on public.work_item_events (work_item_id);

alter table public.work_items enable row level security;
alter table public.work_item_events enable row level security;

-- Read-only for the owner. No insert/update/delete policies: only the service role writes.
create policy "read own work items" on public.work_items
  for select using (user_id = (select auth.uid()));

create policy "read own work item events" on public.work_item_events
  for select using (exists (
    select 1 from public.work_items w
    where w.id = work_item_id and w.user_id = (select auth.uid())));
