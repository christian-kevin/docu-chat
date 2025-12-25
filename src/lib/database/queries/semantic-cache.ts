import { getSupabaseAdmin } from '../client';

export interface SemanticCacheEntry {
  raw_hash: string;
  semantic_text: string;
  created_at: string;
}

export async function getSemanticCache(rawHash: string): Promise<string | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('semantic_cache')
    .select('semantic_text')
    .eq('raw_hash', rawHash)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to get semantic cache: ${error.message}`);
  }

  return data?.semantic_text || null;
}

export async function setSemanticCache(rawHash: string, semanticText: string): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from('semantic_cache')
    .insert({
      raw_hash: rawHash,
      semantic_text: semanticText,
    })
    .select('raw_hash')
    .single();

  if (error) {
    if (error.code === '23505') {
      return;
    }
    throw new Error(`Failed to set semantic cache: ${error.message}`);
  }
}

