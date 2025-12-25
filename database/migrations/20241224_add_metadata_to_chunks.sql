-- Add metadata column to document_chunks table
alter table document_chunks
add column metadata jsonb;

-- Add index on metadata for potential queries
create index document_chunks_metadata_idx on document_chunks using gin (metadata);

