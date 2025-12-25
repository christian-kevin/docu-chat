import { getDocumentFile } from '@/utils/storage';
import { parsePDF } from '@/lib/ingestion/pdf';
import { parseCSV } from '@/lib/ingestion/csv';
import { chunkPDF, chunkCSV } from '@/lib/ingestion/chunking';
import { semanticizeText } from '@/lib/ai/semanticize';
import { embedText } from '@/lib/ai/embeddings';
import {
  acquireProcessingLock,
  markDocumentReady,
  markDocumentFailed,
  deleteDocumentChunks,
} from '@/lib/database/queries/document';
import { getSupabaseAdmin } from '@/lib/database/client';
import { MAX_PDF_PAGES, MAX_CSV_ROWS } from '@/lib/documents/validation';
import pLimit from 'p-limit';

const SEMANTICIZE_CONCURRENCY = 3;
const semanticizeLimit = pLimit(SEMANTICIZE_CONCURRENCY);

const MAX_CHUNKS = 200;

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
      
      if (parsedPDF.pages.length > MAX_PDF_PAGES) {
        await markDocumentFailed(documentId, `Document too large: ${parsedPDF.pages.length} pages (max ${MAX_PDF_PAGES})`);
        throw new Error(`Document too large for synchronous processing: ${parsedPDF.pages.length} pages (max ${MAX_PDF_PAGES})`);
      }
      
      const semanticizedPages = await Promise.all(
        parsedPDF.pages.map((page) =>
          semanticizeLimit(() =>
            semanticizeText({
              content: page.text,
              documentType: 'pdf',
              metadata: { page: page.pageNumber },
            }).then((semanticText) => ({ ...page, text: semanticText }))
          )
        )
      );

      const semanticizedPDF = { ...parsedPDF, pages: semanticizedPages };
      chunks = chunkPDF(semanticizedPDF, document.id, document.conversation_id);
    } else {
      const csvText = fileBuffer.toString('utf-8');
      const entityName = document.filename.replace(/\.csv$/i, '').replace(/[_-]/g, ' ');
      const parsedCSV = parseCSV(csvText, entityName);

      if (parsedCSV.rows.length > MAX_CSV_ROWS) {
        await markDocumentFailed(documentId, `Document too large: ${parsedCSV.rows.length} rows (max ${MAX_CSV_ROWS})`);
        throw new Error(`Document too large for synchronous processing: ${parsedCSV.rows.length} rows (max ${MAX_CSV_ROWS})`);
      }

      const semanticizedRows = await Promise.all(
        parsedCSV.rows.map((row) =>
          semanticizeLimit(() =>
            semanticizeText({
              content: row.serializedText,
              documentType: 'csv',
              metadata: { row: row.rowIndex },
            }).then((semanticText) => ({ ...row, serializedText: semanticText }))
          )
        )
      );

      const semanticizedCSV = { ...parsedCSV, rows: semanticizedRows };
      chunks = chunkCSV(semanticizedCSV, document.id, document.conversation_id);
    }

    if (chunks.length === 0) {
      await markDocumentFailed(documentId, 'No chunks generated');
      return true;
    }

    if (chunks.length > MAX_CHUNKS) {
      await markDocumentFailed(documentId, `Document too large: ${chunks.length} chunks (max ${MAX_CHUNKS})`);
      throw new Error(`Document too large for synchronous processing: ${chunks.length} chunks (max ${MAX_CHUNKS})`);
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

    const chunkContents = chunks.map((chunk) => chunk.content);
    const embeddings = await embedText(chunkContents);

    if (embeddings.length !== chunks.length) {
      await markDocumentFailed(documentId, `Embedding count mismatch: expected ${chunks.length}, got ${embeddings.length}`);
      throw new Error(`Embedding count mismatch: expected ${chunks.length}, got ${embeddings.length}`);
    }

    const { error: updateError } = await getSupabaseAdmin()
      .from('document_chunks')
      .upsert(
        chunks.map((chunk, i) => ({
          id: chunk.id,
          embedding: embeddings[i],
        })),
        { onConflict: 'id' }
      );

    if (updateError) {
      await markDocumentFailed(documentId, `Failed to update embeddings: ${updateError.message}`);
      throw new Error(`Failed to update embeddings: ${updateError.message}`);
    }

    await markDocumentReady(documentId);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await markDocumentFailed(documentId, errorMessage);
    throw error;
  }
}

