import { randomUUID } from 'crypto';
import { saveTempFile } from '@/utils/temp-storage';
import {
  insertDocument,
  selectDocumentsByConversation,
  selectDocumentById,
} from '@/lib/database/queries/document';
import type { Document } from '@/lib/database/schema';

export interface CreateDocumentParams {
  file: globalThis.File;
  conversationId: string;
}

export interface CreateDocumentResult {
  documentId: string;
  status: 'processing' | 'completed' | 'failed';
}

/**
 * Creates a new document record in the database and uploads file to temporary storage.
 * Generates a unique document ID and sets initial status to 'processing'.
 * 
 * @param params - File and conversation ID
 * @returns Document ID and initial status
 * @throws Error if database insert or storage upload fails
 */
export async function createDocument(params: CreateDocumentParams): Promise<CreateDocumentResult> {
  const { file, conversationId } = params;

  const documentId = randomUUID();
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const fileType = file.type.includes('pdf') ? 'pdf' : 'csv';

  await saveTempFile(fileBuffer, file.name);

  await insertDocument({
    id: documentId,
    conversation_id: conversationId,
    filename: file.name,
    file_type: fileType,
    status: 'processing',
  });

  return {
    documentId,
    status: 'processing',
  };
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

