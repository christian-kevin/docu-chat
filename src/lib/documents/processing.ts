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
const MAX_PROCESSING_ATTEMPTS = 15;

export async function processDocument(documentId: string): Promise<boolean> {
  console.log(`[processDocument] Starting processing for document: ${documentId}`);
  
  const document = await acquireProcessingLock(documentId);
  if (!document) {
    console.log(`[processDocument] Failed to acquire lock for document: ${documentId}`);
    return false;
  }

  console.log(`[processDocument] Lock acquired for document: ${documentId}, type: ${document.file_type}, filename: ${document.filename}, attempts: ${document.processing_attempts}`);

  if (document.processing_attempts >= MAX_PROCESSING_ATTEMPTS) {
    console.error(`[processDocument] Max processing attempts (${MAX_PROCESSING_ATTEMPTS}) reached for document: ${documentId}`);
    await markDocumentFailed(documentId, `Max processing attempts (${MAX_PROCESSING_ATTEMPTS}) exceeded`);
    return false;
  }

  if (!document.storage_path) {
    console.error(`[processDocument] Missing storage_path for document: ${documentId}`);
    await markDocumentFailed(documentId, 'Missing storage_path');
    throw new Error('Document has no storage_path');
  }

  try {
    console.log(`[processDocument] Downloading file from storage: ${document.storage_path}`);
    const fileBuffer = await getDocumentFile(document.storage_path);
    console.log(`[processDocument] File downloaded, size: ${fileBuffer.length} bytes`);

    let chunks;
    if (document.file_type === 'pdf') {
      console.log(`[processDocument] Parsing PDF document: ${documentId}`);
      const parsedPDF = await parsePDF(fileBuffer);
      console.log(`[processDocument] PDF parsed, pages: ${parsedPDF.pages.length}`);
      
      if (parsedPDF.pages.length > MAX_PDF_PAGES) {
        console.error(`[processDocument] PDF too large: ${parsedPDF.pages.length} pages (max ${MAX_PDF_PAGES})`);
        await markDocumentFailed(documentId, `Document too large: ${parsedPDF.pages.length} pages (max ${MAX_PDF_PAGES})`);
        throw new Error(`Document too large for synchronous processing: ${parsedPDF.pages.length} pages (max ${MAX_PDF_PAGES})`);
      }
      
      console.log(`[processDocument] Semanticizing ${parsedPDF.pages.length} PDF pages (concurrency: ${SEMANTICIZE_CONCURRENCY})`);
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

      console.log(`[processDocument] PDF semanticization complete`);
      const semanticizedPDF = { ...parsedPDF, pages: semanticizedPages };
      console.log(`[processDocument] Chunking PDF document`);
      chunks = chunkPDF(semanticizedPDF, document.id, document.conversation_id);
      console.log(`[processDocument] PDF chunked into ${chunks.length} chunks`);
    } else {
      console.log(`[processDocument] Parsing CSV document: ${documentId}`);
      const csvText = fileBuffer.toString('utf-8');
      const entityName = document.filename.replace(/\.csv$/i, '').replace(/[_-]/g, ' ');
      const parsedCSV = parseCSV(csvText, entityName);
      console.log(`[processDocument] CSV parsed, rows: ${parsedCSV.rows.length}`);

      if (parsedCSV.rows.length > MAX_CSV_ROWS) {
        console.error(`[processDocument] CSV too large: ${parsedCSV.rows.length} rows (max ${MAX_CSV_ROWS})`);
        await markDocumentFailed(documentId, `Document too large: ${parsedCSV.rows.length} rows (max ${MAX_CSV_ROWS})`);
        throw new Error(`Document too large for synchronous processing: ${parsedCSV.rows.length} rows (max ${MAX_CSV_ROWS})`);
      }

      console.log(`[processDocument] Semanticizing ${parsedCSV.rows.length} CSV rows (concurrency: ${SEMANTICIZE_CONCURRENCY})`);
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

      console.log(`[processDocument] CSV semanticization complete`);
      const semanticizedCSV = { ...parsedCSV, rows: semanticizedRows };
      console.log(`[processDocument] Chunking CSV document`);
      chunks = chunkCSV(semanticizedCSV, document.id, document.conversation_id);
      console.log(`[processDocument] CSV chunked into ${chunks.length} chunks`);
    }

    if (chunks.length === 0) {
      console.error(`[processDocument] No chunks generated for document: ${documentId}`);
      await markDocumentFailed(documentId, 'No chunks generated');
      return true;
    }

    if (chunks.length > MAX_CHUNKS) {
      console.error(`[processDocument] Too many chunks: ${chunks.length} (max ${MAX_CHUNKS})`);
      await markDocumentFailed(documentId, `Document too large: ${chunks.length} chunks (max ${MAX_CHUNKS})`);
      throw new Error(`Document too large for synchronous processing: ${chunks.length} chunks (max ${MAX_CHUNKS})`);
    }

    console.log(`[processDocument] Deleting existing chunks for document: ${documentId}`);
    await deleteDocumentChunks(document.id);

    console.log(`[processDocument] Inserting ${chunks.length} chunks into database`);
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
      console.error(`[processDocument] Failed to insert chunks: ${insertError.message}`);
      await markDocumentFailed(documentId, `Failed to insert chunks: ${insertError.message}`);
      throw new Error(`Failed to insert chunks: ${insertError.message}`);
    }

    console.log(`[processDocument] Chunks inserted. Generating embeddings for ${chunks.length} chunks`);
    const chunkContents = chunks.map((chunk) => chunk.content);
    const embeddings = await embedText(chunkContents);
    console.log(`[processDocument] Embeddings generated: ${embeddings.length} vectors`);

    if (embeddings.length !== chunks.length) {
      console.error(`[processDocument] Embedding count mismatch: expected ${chunks.length}, got ${embeddings.length}`);
      await markDocumentFailed(documentId, `Embedding count mismatch: expected ${chunks.length}, got ${embeddings.length}`);
      throw new Error(`Embedding count mismatch: expected ${chunks.length}, got ${embeddings.length}`);
    }

    console.log(`[processDocument] Updating chunk embeddings in database`);
    const updatePromises = chunks.map((chunk, i) =>
      getSupabaseAdmin()
        .from('document_chunks')
        .update({ embedding: embeddings[i] })
        .eq('id', chunk.id)
    );
    
    const updateResults = await Promise.all(updatePromises);
    const failedUpdate = updateResults.find((result) => result.error);
    
    if (failedUpdate?.error) {
      console.error(`[processDocument] Failed to update embeddings: ${failedUpdate.error.message}`);
      await markDocumentFailed(documentId, `Failed to update embeddings: ${failedUpdate.error.message}`);
      throw new Error(`Failed to update embeddings: ${failedUpdate.error.message}`);
    }

    console.log(`[processDocument] Embeddings updated. Marking document as ready: ${documentId}`);
    await markDocumentReady(documentId);
    console.log(`[processDocument] Document processing complete: ${documentId}`);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[processDocument] Error processing document ${documentId}:`, errorMessage);
    await markDocumentFailed(documentId, errorMessage);
    throw error;
  }
}

