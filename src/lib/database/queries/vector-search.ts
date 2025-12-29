import { getSupabaseAdmin } from '../client';

export interface VectorSearchResult {
  id: string;
  document_id: string;
  content: string;
  similarity: number;
}

export async function searchDocumentChunks(params: {
  queryEmbedding: number[];
  conversationId: string;
  matchThreshold?: number | null;
  matchCount?: number;
  includeSimilarity?: boolean;
}): Promise<VectorSearchResult[]> {
  const { queryEmbedding, conversationId, matchThreshold = 0.3, matchCount = 15 } = params;

  const { data, error } = await getSupabaseAdmin().rpc('match_document_chunks', {
    query_embedding: queryEmbedding,
    match_threshold: matchThreshold,
    match_count: matchCount,
    conversation_id_input: conversationId,
  });

  if (error) {
    throw new Error(`Failed to search document chunks: ${error.message}`);
  }

  return (data || []) as VectorSearchResult[];
}

