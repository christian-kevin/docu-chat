import { pipeline, env } from '@xenova/transformers';

// Configure cache directory for serverless environments (Vercel, AWS Lambda, etc.)
// The file cache is for ML model weights (not semantic cache which goes to Supabase)
// Use /tmp which is writable in serverless environments
if (typeof process !== 'undefined') {
  // Set cache to /tmp for all serverless environments
  env.cacheDir = '/tmp/.cache';
  // Also set local filesystem cache to false to avoid issues
  env.allowLocalModels = false;
}

let extractor: any;

async function getModel() {
  if (!extractor) {
    extractor = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2'
    );
  }
  return extractor;
}

async function embed(texts: string[]): Promise<number[][]> {
  const model = await getModel();
  const output = await model(texts, {
    pooling: 'mean',
    normalize: true,
  });
  return output.tolist();
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
  return embed(texts);
}

export async function embedQuery(query: string): Promise<number[]> {
  const results = await embed([query]);
  if (results.length !== 1) {
    throw new Error(`Expected single embedding, got ${results.length}`);
  }
  return results[0];
}

