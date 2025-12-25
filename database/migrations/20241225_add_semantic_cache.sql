-- Create semantic cache table for persistent caching in serverless environments
create table if not exists semantic_cache (
  raw_hash text primary key,
  semantic_text text not null,
  created_at timestamptz not null default now()
);

-- Index for cleanup queries (optional, for retention policies)
create index if not exists semantic_cache_created_at_idx
  on semantic_cache(created_at);

