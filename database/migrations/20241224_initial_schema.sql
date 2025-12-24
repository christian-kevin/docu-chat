-- Enable required extensions
create extension if not exists vector;
create extension if not exists pgcrypto;

-- conversations table
create table conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now()
);

-- documents table
create table documents (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  filename text not null,
  file_type text not null check (file_type in ('pdf','csv')),
  status text default 'processing',
  created_at timestamptz default now()
);
create index on documents(conversation_id);

-- document_chunks table
create table document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  embedding vector(1536),
  created_at timestamptz default now()
);
create index on document_chunks(document_id);
create index on document_chunks(conversation_id);

-- Vector index for efficient similarity search
create index document_chunks_embedding_idx
on document_chunks
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);
analyze document_chunks;

-- messages table
create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text check (role in ('user','assistant','system')),
  content text not null,
  created_at timestamptz default now()
);
create index on messages(conversation_id);

-- Vector search RPC function
create or replace function match_document_chunks (
  query_embedding vector(1536),
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
