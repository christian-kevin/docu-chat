-- RPC function for atomic lock acquisition with increment
create or replace function acquire_document_processing_lock(
  p_document_id uuid
)
returns documents
language plpgsql
as $$
declare
  v_document documents;
begin
  update documents
  set
    processing_started_at = now(),
    processing_attempts = processing_attempts + 1
  where
    id = p_document_id
    and status = 'processing'
    and processing_started_at is null
    and deleted_at is null
  returning * into v_document;

  return v_document;
end;
$$;

