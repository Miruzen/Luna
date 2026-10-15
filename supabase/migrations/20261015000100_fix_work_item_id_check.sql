-- Fix: Postgres regex repetition counts are capped at 255, so '^[0-9a-v]{5,1024}$' failed at
-- insert time ("invalid repetition count(s)"). Same rule, expressed without a large count.
alter table public.work_items drop constraint work_items_id_check;
alter table public.work_items add constraint work_items_id_check
  check (id ~ '^[0-9a-v]+$' and char_length(id) between 5 and 1024);
