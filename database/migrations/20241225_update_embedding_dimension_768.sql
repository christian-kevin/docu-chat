-- Update embedding dimension from 1536 to 384 for all-MiniLM-L6-v2 model
-- This migration changes the vector dimension to match Xenova/all-MiniLM-L6-v2 model

-- Drop the existing vector index
drop index if exists document_chunks_embedding_idx;

-- Alter the embedding column to use 384 dimensions
alter table document_chunks 
  alter column embedding type vector(384) using embedding::vector(384);

-- Update the match_document_chunks function to use 384 dimensions
create or replace function match_document_chunks (
  query_embedding vector(384),
  match_threshold float,
  match_count int,
  conversation_id_input uuid
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  similarity float
)
language sql stable
as $$
select
  dc.id,
  dc.document_id,
  dc.content,
  1 - (dc.embedding <=> query_embedding) as similarity
from document_chunks dc
where dc.conversation_id = conversation_id_input
  and dc.embedding is not null
  and 1 - (dc.embedding <=> query_embedding) >= match_threshold
order by dc.embedding <=> query_embedding
limit match_count;
$$;

-- Recreate the vector index with updated dimension
create index document_chunks_embedding_idx
on document_chunks
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

analyze document_chunks;

