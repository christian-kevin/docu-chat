import type { ParsedPDF } from './pdf';
import type { ParsedCSV } from './csv';
import type { DocumentChunk, DocumentChunkMetadata } from '@/lib/database/schema';
import { randomUUID } from 'crypto';
import { split } from 'sentence-splitter';

export type ChunkWithMetadata = DocumentChunk;

// Token estimation: 1 token ≈ 4 characters (rough approximation)
// Tradeoffs:
// - CJK text (Japanese/Chinese) breaks this badly
// - Numbers and symbols skew counts
// - PDFs often have no spaces
// Recommendation: Keep for MVP, but consider tiktoken or similar for production
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
}

// Chunking algorithm: targets 300-500 tokens per chunk
// Handles oversized paragraphs by splitting at sentence boundaries
function chunkParagraphs(paragraphs: string[], targetMinTokens: number = 300, targetMaxTokens: number = 500): string[] {
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentTokenCount = 0;

  for (const paragraph of paragraphs) {
    const paragraphTokens = estimateTokens(paragraph);

    if (paragraphTokens > targetMaxTokens) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.join('\n\n'));
        currentChunk = [];
        currentTokenCount = 0;
      }

      // Split oversized paragraph by sentences
      // Tradeoffs: Breaks on abbreviations (e.g.), decimals (3.14), non-English punctuation
      // For ingestion, this is acceptable and common
      // Improvement: Use Intl.Segmenter (Node 18+) for production
      const sentences = paragraph.split(/[.!?]+\s+/).filter(s => s.trim().length > 0);
      let sentenceChunk: string[] = [];
      let sentenceTokenCount = 0;

      for (const sentence of sentences) {
        const sentenceTokens = estimateTokens(sentence);
        
        if (sentenceTokenCount + sentenceTokens > targetMaxTokens && sentenceChunk.length > 0) {
          chunks.push(sentenceChunk.join(' '));
          sentenceChunk = [];
          sentenceTokenCount = 0;
        }
        
        sentenceChunk.push(sentence);
        sentenceTokenCount += sentenceTokens;
      }
      
      if (sentenceChunk.length > 0) {
        chunks.push(sentenceChunk.join(' '));
      }
      continue;
    }

    if (currentTokenCount + paragraphTokens > targetMaxTokens && currentChunk.length > 0) {
      if (currentTokenCount >= targetMinTokens) {
        chunks.push(currentChunk.join('\n\n'));
        currentChunk = [];
        currentTokenCount = 0;
      }
    }

    currentChunk.push(paragraph);
    currentTokenCount += paragraphTokens;

    if (currentTokenCount >= targetMinTokens) {
      chunks.push(currentChunk.join('\n\n'));
      currentChunk = [];
      currentTokenCount = 0;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join('\n\n'));
  }

  return chunks;
}

export function chunkPDF(
  parsedPDF: ParsedPDF,
  documentId: string,
  conversationId: string
): ChunkWithMetadata[] {
  const allChunks: ChunkWithMetadata[] = [];
  let globalChunkIndex = 0;

  for (const page of parsedPDF.pages) {
    const sentences = split(page.text)
      .filter((s: any) => s.type === 'Sentence')
      .map((s: any) => s.raw.trim())
      .filter((s: string) => s.length > 0);

    for (const sentence of sentences) {
      allChunks.push({
        id: randomUUID(),
        document_id: documentId,
        conversation_id: conversationId,
        chunk_index: globalChunkIndex++,
        content: sentence,
        embedding: null,
        created_at: new Date().toISOString(),
        metadata: {
          pageNumber: page.pageNumber,
        },
      });
    }
  }

  return allChunks;
}

export function chunkCSV(
  parsedCSV: ParsedCSV,
  documentId: string,
  conversationId: string
): ChunkWithMetadata[] {
  return parsedCSV.rows.map((row, index) => {
    const metadata: DocumentChunkMetadata = {
      rowIndex: row.rowIndex,
    };
    
    return {
      id: randomUUID(),
      document_id: documentId,
      conversation_id: conversationId,
      chunk_index: index,
      content: row.serializedText,
      embedding: null,
      metadata,
      created_at: new Date().toISOString(),
    };
  });
}