-- Add soft delete column to documents table
alter table documents
  add column if not exists deleted_at timestamptz;

-- Create index for efficient filtering of non-deleted documents
create index if not exists documents_not_deleted_idx
  on documents(conversation_id, created_at)
  where deleted_at is null;

