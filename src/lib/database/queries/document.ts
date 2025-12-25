import { getSupabaseAdmin } from '@/lib/database/client';
import type { Document } from '@/lib/database/schema';

export interface InsertDocumentParams {
  conversation_id: string;
  filename: string;
  file_type: 'pdf' | 'csv';
}

/**
 * Inserts a new document record into the database.
 * 
 * @param params - Document data to insert
 * @throws Error if database insert fails
 */
export async function insertDocument(params: InsertDocumentParams): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from('documents')
    .insert({
      conversation_id: params.conversation_id,
      filename: params.filename,
      file_type: params.file_type,
      status: 'uploading',
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create document record: ${error.message}`);
  }
}

/**
 * Retrieves all documents for a specific conversation, ordered by creation date (newest first).
 * 
 * @param conversationId - Conversation ID to filter documents
 * @returns Array of document records
 * @throws Error if database query fails
 */
export async function selectDocumentsByConversation(conversationId: string): Promise<Document[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('documents')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch documents: ${error.message}`);
  }

  return (data || []) as Document[];
}

/**
 * Retrieves a single document by its ID.
 * 
 * @param documentId - Document ID to fetch
 * @returns Document record or null if not found
 * @throws Error if database query fails (except when document not found)
 */
export async function selectDocumentById(documentId: string): Promise<Document | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to fetch document: ${error.message}`);
  }

  return data as Document;
}

