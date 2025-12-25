import { openrouterClient } from './openrouter-client';

/**
 * @param texts - Array of text strings to embed
 * @returns Array of embedding vectors
 * @throws Error if embedding fails
 */
export async function embedText(texts: string[]): Promise<number[][]> {
  const res = await openrouterClient.embeddings.create({
    model: 'nomic-ai/nomic-embed-text',
    input: texts,
  });
  return res.data.map((item) => item.embedding);
}

