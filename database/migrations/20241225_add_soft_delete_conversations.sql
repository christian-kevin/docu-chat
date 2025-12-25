-- Add soft delete column to conversations table
alter table conversations
  add column if not exists deleted_at timestamptz;

-- Create index for efficient filtering of non-deleted conversations
create index if not exists conversations_deleted_at_idx
  on conversations(deleted_at)
  where deleted_at is not null;

