import { getSupabaseAdmin } from '@/lib/database/client';
import type { Document } from '@/lib/database/schema';

export interface InsertDocumentParams {
  conversation_id: string;
  filename: string;
  file_type: 'pdf' | 'csv';
}

/**
 * @param params - Document data to insert
 * @returns Generated document ID
 * @throws Error if database insert fails
 */
export async function insertDocument(params: InsertDocumentParams): Promise<string> {
  const { data, error } = await getSupabaseAdmin()
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

  return data.id;
}

/**
 * @param documentId - Document ID
 * @param storagePath - Storage path where file was uploaded
 * @throws Error if update fails or no rows affected
 */
export async function updateDocumentAfterUpload(
  documentId: string,
  storagePath: string
): Promise<void> {
  const { data, error } = await getSupabaseAdmin()
    .from('documents')
    .update({
      status: 'processing',
      storage_path: storagePath,
    })
    .eq('id', documentId)
    .eq('status', 'uploading')
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to update document after upload: ${error.message}`);
  }

  if (!data) {
    throw new Error('Document not in expected state (uploading)');
  }
}

/**
 * @param documentId - Document ID
 * @param errorReason - Error message
 * @throws Error if update fails or no rows affected
 */
export async function markDocumentFailed(
  documentId: string,
  errorReason: string
): Promise<void> {
  const { data, error } = await getSupabaseAdmin()
    .from('documents')
    .update({
      status: 'failed',
      error_reason: errorReason,
    })
    .eq('id', documentId)
    .in('status', ['uploading', 'processing'])
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to mark document as failed: ${error.message}`);
  }

  if (!data) {
    throw new Error('Document not in expected state (uploading or processing)');
  }
}

/**
 * @param documentId - Document ID to lock
 * @returns Locked document or null if already locked
 * @throws Error if query fails
 */
export async function acquireProcessingLock(documentId: string): Promise<Document | null> {
  const { data, error } = await getSupabaseAdmin()
    .rpc('acquire_document_processing_lock', {
      p_document_id: documentId,
    })
    .single();

  if (error) {
    if (error.code === 'PGRST116' || error.code === '42883') {
      return null;
    }
    throw new Error(`Failed to acquire processing lock: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return data as Document;
}

/**
 * @param documentId - Document ID
 * @throws Error if update fails or no rows affected
 */
export async function markDocumentReady(documentId: string): Promise<void> {
  const { data, error } = await getSupabaseAdmin()
    .from('documents')
    .update({
      status: 'ready',
    })
    .eq('id', documentId)
    .eq('status', 'processing')
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to mark document as ready: ${error.message}`);
  }

  if (!data) {
    throw new Error('Document not in expected state (processing)');
  }
}

/**
 * @param documentId - Document ID
 * @throws Error if deletion fails
 */
export async function deleteDocumentChunks(documentId: string): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from('document_chunks')
    .delete()
    .eq('document_id', documentId);

  if (error) {
    throw new Error(`Failed to delete document chunks: ${error.message}`);
  }
}

/**
 * @param chunkId - Chunk ID
 * @param embedding - Embedding vector
 * @throws Error if update fails
 */
export async function updateChunkEmbedding(chunkId: string, embedding: number[]): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from('document_chunks')
    .update({ embedding })
    .eq('id', chunkId)
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to update chunk embedding: ${error.message}`);
  }
}

/**
 * @param conversationId - Conversation ID to filter documents
 * @returns Array of document records (excluding soft-deleted)
 * @throws Error if database query fails
 */
export async function selectDocumentsByConversation(conversationId: string): Promise<Document[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('documents')
    .select('*')
    .eq('conversation_id', conversationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch documents: ${error.message}`);
  }

  return (data || []) as Document[];
}

/**
 * @param documentId - Document ID to fetch
 * @returns Document record or null if not found
 * @throws Error if database query fails (except when document not found)
 */
export async function selectDocumentById(documentId: string): Promise<Document | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to fetch document: ${error.message}`);
  }

  return data as Document;
}

/**
 * @param documentId - Document ID to soft delete
 * @throws Error if update fails or no rows affected
 */
export async function softDeleteDocument(documentId: string): Promise<void> {
  const { data, error } = await getSupabaseAdmin()
    .from('documents')
    .update({
      deleted_at: new Date().toISOString(),
    })
    .eq('id', documentId)
    .is('deleted_at', null)
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to soft delete document: ${error.message}`);
  }

  if (!data) {
    throw new Error('Document not found or already deleted');
  }
}

