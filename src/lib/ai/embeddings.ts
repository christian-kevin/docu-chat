import { openrouterClient } from './openrouter-client';

const EMBEDDING_BATCH_SIZE = 50;
const MAX_RETRIES = 2;

async function embedBatch(texts: string[], retryCount = 0): Promise<number[][]> {
  try {
    const res = await openrouterClient.embeddings.create({
      model: 'nomic-ai/nomic-embed-text',
      input: texts,
    });
    return res.data.map((item) => item.embedding);
  } catch (error) {
    if (retryCount < MAX_RETRIES && error instanceof Error) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * (retryCount + 1)));
      return embedBatch(texts, retryCount + 1);
    }
    throw error;
  }
}

/**
 * @param texts - Array of text strings to embed
 * @returns Array of embedding vectors
 * @throws Error if embedding fails
 */
export async function embedText(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  if (texts.length <= EMBEDDING_BATCH_SIZE) {
    return embedBatch(texts);
  }

  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);
    const batchResults = await embedBatch(batch);
    results.push(...batchResults);
  }

  return results;
}

