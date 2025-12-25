import { getDocumentFile } from '@/utils/storage';
import { parsePDF } from '@/lib/ingestion/pdf';
import { parseCSV } from '@/lib/ingestion/csv';
import { chunkPDF, chunkCSV } from '@/lib/ingestion/chunking';
import {
  acquireProcessingLock,
  markDocumentReady,
  markDocumentFailed,
  deleteDocumentChunks,
} from '@/lib/database/queries/document';
import { getSupabaseAdmin } from '@/lib/database/client';
import type { Document } from '@/lib/database/schema';

export async function processDocument(documentId: string): Promise<boolean> {
  const document = await acquireProcessingLock(documentId);
  if (!document) {
    return false;
  }

  if (!document.storage_path) {
    await markDocumentFailed(documentId, 'Missing storage_path');
    throw new Error('Document has no storage_path');
  }

  try {
    const fileBuffer = await getDocumentFile(document.storage_path);

    let chunks;
    if (document.file_type === 'pdf') {
      const parsedPDF = await parsePDF(fileBuffer);
      chunks = chunkPDF(parsedPDF, document.id, document.conversation_id);
    } else {
      const csvText = fileBuffer.toString('utf-8');
      const entityName = document.filename.replace(/\.csv$/i, '').replace(/[_-]/g, ' ');
      const parsedCSV = parseCSV(csvText, entityName);
      chunks = chunkCSV(parsedCSV, document.id, document.conversation_id);
    }

    if (chunks.length === 0) {
      await markDocumentFailed(documentId, 'No chunks generated');
      return true;
    }

    await deleteDocumentChunks(document.id);

    const { error: insertError } = await getSupabaseAdmin()
      .from('document_chunks')
      .insert(
        chunks.map((chunk) => ({
          id: chunk.id,
          document_id: chunk.document_id,
          conversation_id: chunk.conversation_id,
          chunk_index: chunk.chunk_index,
          content: chunk.content,
          embedding: null,
          metadata: chunk.metadata,
          created_at: chunk.created_at,
        }))
      );

    if (insertError) {
      await markDocumentFailed(documentId, `Failed to insert chunks: ${insertError.message}`);
      throw new Error(`Failed to insert chunks: ${insertError.message}`);
    }

    await markDocumentReady(documentId);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await markDocumentFailed(documentId, errorMessage);
    throw error;
  }
}

