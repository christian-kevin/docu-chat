import { saveDocumentFile } from '@/utils/storage';
import {
  insertDocument,
  updateDocumentAfterUpload,
  markDocumentFailed,
  selectDocumentsByConversation,
  selectDocumentById,
} from '@/lib/database/queries/document';
import { createMessage } from '@/lib/database/queries/message';
import type { Document } from '@/lib/database/schema';

export interface CreateDocumentParams {
  file: globalThis.File;
  conversationId: string;
}

export interface CreateDocumentResult {
  documentId: string;
  status: 'uploading' | 'processing' | 'ready' | 'failed';
}

/**
 * Creates a new document using DB-first pattern (reliable ingestion).
 * Step 1: Insert DB row with status 'uploading'
 * Step 2: Upload file to storage (deterministic path)
 * Step 3: Update DB row to 'processing' with storage_path
 * 
 * @param params - File and conversation ID
 * @returns Document ID and initial status
 * @throws Error if any step fails
 */
export async function createDocument(params: CreateDocumentParams): Promise<CreateDocumentResult> {
  const { file, conversationId } = params;

  const existingDocuments = await selectDocumentsByConversation(conversationId);
  if (existingDocuments.length > 0) {
    throw new Error('Conversation already has a document. Only one document per conversation is allowed.');
  }

  const fileType = file.type.includes('pdf') ? 'pdf' : 'csv';
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  const documentId = await insertDocument({
    conversation_id: conversationId,
    filename: file.name,
    file_type: fileType,
  });

  try {
    const storagePath = await saveDocumentFile(
      fileBuffer,
      conversationId,
      documentId,
      file.name
    );

    await updateDocumentAfterUpload(documentId, storagePath);

    await createMessage({
      conversation_id: conversationId,
      role: 'system',
      content: `Document "${file.name}" uploaded and processing started.`,
    });

    return {
      documentId,
      status: 'processing',
    };
  } catch (error) {
    // If upload fails, mark document as failed
    const errorMessage = error instanceof Error ? error.message : 'UPLOAD_FAILED';
    await markDocumentFailed(documentId, errorMessage);
    throw error;
  }
}

/**
 * Retrieves all documents for a specific conversation, ordered by creation date (newest first).
 * 
 * @param conversationId - Conversation ID to filter documents
 * @returns Array of document records
 * @throws Error if database query fails
 */
export async function getDocumentsByConversation(conversationId: string): Promise<Document[]> {
  return selectDocumentsByConversation(conversationId);
}

/**
 * Retrieves a single document by its ID.
 * 
 * @param documentId - Document ID to fetch
 * @returns Document record or null if not found
 * @throws Error if database query fails (except when document not found)
 */
export async function getDocumentById(documentId: string): Promise<Document | null> {
  return selectDocumentById(documentId);
}

