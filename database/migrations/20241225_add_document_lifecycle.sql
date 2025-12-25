-- Add required columns for document lifecycle and locking
alter table documents
  add column if not exists status text,
  add column if not exists processing_started_at timestamptz,
  add column if not exists processing_attempts int not null default 0,
  add column if not exists error_reason text,
  add column if not exists storage_path text;

-- Backfill existing rows (important)
update documents
set status = 'ready'
where status is null;

-- Set default for new rows
alter table documents
  alter column status set default 'uploading';

-- Enforce valid states
alter table documents
  drop constraint if exists documents_status_check;

alter table documents
  add constraint documents_status_check
  check (status in ('uploading', 'processing', 'ready', 'failed'));

-- Index for cleaning up stuck uploads
create index if not exists documents_uploading_created_at_idx
  on documents(created_at)
  where status = 'uploading';

-- Index for fast lock acquisition
create index if not exists documents_processing_lock_idx
  on documents(id)
  where status = 'processing'
    and processing_started_at is null;
