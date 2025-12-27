import { openrouterClient } from './openrouter-client';
import { createHash } from 'crypto';
import { getSemanticCache, setSemanticCache } from '../database/queries/semantic-cache';

const semanticCache = new Map<string, string>();
const MAX_CONTENT_LENGTH = 8000;
const SEMANTICIZE_TIMEOUT_MS = 15000;
const MAX_RETRIES = 1;

function hashContent(content: string, metadata?: Record<string, string | number>): string {
  const data = content + JSON.stringify(metadata || {});
  return createHash('sha256').update(data).digest('hex');
}

/**
 * @param params - Content, document type, and optional metadata
 * @returns Semantic enriched text
 * @throws Error if content too large or semantic enrichment fails
 */
export async function semanticizeText(params: {
  content: string;
  documentType: 'pdf' | 'csv';
  metadata?: Record<string, string | number>;
}): Promise<string> {
  const { content, documentType, metadata } = params;

  if (content.length > MAX_CONTENT_LENGTH) {
    throw new Error(`Content too large for semanticization: ${content.length} characters (max ${MAX_CONTENT_LENGTH})`);
  }

  const cacheKey = hashContent(content, metadata);
  
  const inMemoryCached = semanticCache.get(cacheKey);
  if (inMemoryCached) {
    return inMemoryCached;
  }

  const dbCached = await getSemanticCache(cacheKey);
  if (dbCached) {
    semanticCache.set(cacheKey, dbCached);
    return dbCached;
  }

  const systemPrompt = `
You are a data normalization engine.
Rewrite the input text into clear, concise, factual sentences.
Preserve the original meaning exactly.
Do NOT add new information.
Do NOT add assumptions or interpretations.
Do NOT infer missing values.
Do NOT use opinions or explanations.
If information is incomplete, keep it incomplete.
Output plain text only.
`;

  const metadataSection = metadata
    ? `Metadata (must be reflected in output if relevant):
${JSON.stringify(metadata, null, 2)}`
    : 'Metadata: none';

  const userPrompt = `
Document type: ${documentType}

${metadataSection}

Raw content:
${content}

Rewrite the content into complete, semantic sentences suitable for vector embedding.
If metadata is provided (e.g., page number, row index), incorporate it naturally into the semantic text.
`;

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let timeoutId: NodeJS.Timeout | null = null;
    try {
      const abortController = new AbortController();
      timeoutId = setTimeout(() => {
        abortController.abort();
      }, SEMANTICIZE_TIMEOUT_MS);

      const response = await openrouterClient.chat.completions.create(
        {
          model: 'mistralai/mistral-7b-instruct',
          temperature: 0,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        },
        {
          signal: abortController.signal,
        }
      );

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      const semanticText = response.choices[0]?.message?.content?.trim();

      if (!semanticText) {
        // Log the full response for debugging
        console.error('[semanticize] Empty response from LLM:', {
          attempt: attempt + 1,
          responseId: response.id,
          model: response.model,
          choices: response.choices?.length || 0,
          finishReason: response.choices[0]?.finish_reason,
          rawContent: response.choices[0]?.message?.content,
          contentLength: content.length,
          contentPreview: content.substring(0, 100),
        });
        
        // Retry on empty response, or fallback to original content on final attempt (PDF only)
        lastError = new Error('Semantic enrichment failed: empty output from LLM');
        if (attempt < MAX_RETRIES) {
          continue;
        } else {
          // Final attempt failed - fallback to original content only for PDFs
          if (documentType === 'pdf') {
            console.warn('[semanticize] All retries exhausted, falling back to original content (PDF)');
            return content;
          } else {
            // For CSV, throw error instead of using original content
            throw new Error('Semantic enrichment failed: empty output from LLM (CSV requires semanticization)');
          }
        }
      }

      semanticCache.set(cacheKey, semanticText);
      await setSemanticCache(cacheKey, semanticText);
      return semanticText;
    } catch (error) {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      if (error instanceof Error && error.name === 'AbortError') {
        lastError = new Error(`Semantic enrichment timeout after ${SEMANTICIZE_TIMEOUT_MS}ms`);
        if (attempt < MAX_RETRIES) {
          continue;
        }
      } else {
        // Log other errors for debugging
        console.error('[semanticize] Error during semanticization:', {
          attempt: attempt + 1,
          error: error instanceof Error ? error.message : String(error),
          errorName: error instanceof Error ? error.name : 'Unknown',
          contentLength: content.length,
          contentPreview: content.substring(0, 100),
        });
        
        // On final attempt, fallback to original content for non-critical errors (PDF only)
        if (attempt >= MAX_RETRIES && error instanceof Error) {
          if (documentType === 'pdf') {
            console.warn('[semanticize] Final attempt failed, falling back to original content (PDF)');
            return content;
          } else {
            // For CSV, throw error instead of using original content
            throw new Error(`Semantic enrichment failed for CSV: ${error.message}`);
          }
        }
        
        throw error;
      }
    }
  }

  throw lastError || new Error('Semantic enrichment failed after retries');
}

