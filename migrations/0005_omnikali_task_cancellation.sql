-- Durable cancellation request/acknowledgement metadata for the PostgreSQL task executor.
-- Task lifecycle remains PENDING -> RUNNING -> COMPLETED | FAILED.
alter table omnikali_tasks
  add column if not exists cancel_requested_at timestamptz,
  add column if not exists cancel_requested_by text,
  add column if not exists cancel_acknowledged_at timestamptz,
  add column if not exists cancel_reconciliation_deadline timestamptz;

create index if not exists omnikali_tasks_cancellation_idx
  on omnikali_tasks (state, cancel_requested_at)
  where cancel_requested_at is not null;
