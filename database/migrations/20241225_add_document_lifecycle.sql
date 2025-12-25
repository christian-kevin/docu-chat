-- Add required columns for document lifecycle and row-level locking
alter table documents 
  add column if not exists status text default 'uploading',
  add column if not exists processing_started_at timestamptz,
  add column if not exists processing_attempts int default 0,
  add column if not exists error_reason text,
  add column if not exists storage_path text;

-- Update status constraint to include new states
alter table documents 
  drop constraint if exists documents_status_check;

alter table documents 
  add constraint documents_status_check 
  check (status in ('uploading', 'processing', 'ready', 'failed'));

-- Create index for efficient cleanup queries
create index if not exists documents_status_created_at_idx 
  on documents(status, created_at) 
  where status = 'uploading';

-- Create index for processing lock queries
create index if not exists documents_processing_idx 
  on documents(status, processing_started_at) 
  where status = 'processing';

