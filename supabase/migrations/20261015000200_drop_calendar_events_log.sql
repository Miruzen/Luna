-- Stage 2, DEC-004 (accepted by Nanda 2026-10-15): work_items/work_item_events are the single
-- record of executed actions, so the calendar-only V0.1 log is removed.
-- Checked before dropping: no code reads it, no table/view/trigger/function depends on it,
-- and luna-execute stopped writing to it (deployed before this migration). Its 3 rows were test data.
-- Full engine error text now lives in work_items.last_result.detail.
drop table public.calendar_events_log;
