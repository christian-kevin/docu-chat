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