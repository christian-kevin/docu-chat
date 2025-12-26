-- Update match_document_chunks function to support nullable match_threshold
-- When match_threshold is null, return all results without threshold filtering

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
  and (match_threshold is null or 1 - (dc.embedding <=> query_embedding) >= match_threshold)
order by dc.embedding <=> query_embedding
limit match_count;
$$;

