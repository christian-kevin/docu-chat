import { getSupabaseAdmin } from '@/lib/database/client';
import { MAX_FILE_SIZE } from '@/lib/documents/validation';

const STORAGE_BUCKET = 'uploads';

/**
 * Ensures the uploads storage bucket exists in Supabase Storage.
 * Creates the bucket if it doesn't exist with private access and file size limit.
 */
async function ensureBucket(): Promise<void> {
  const { data: buckets, error } = await getSupabaseAdmin().storage.listBuckets();
  
  if (error) {
    throw new Error(`Failed to list storage buckets: ${error.message}`);
  }

  const bucketExists = buckets?.some(bucket => bucket.name === STORAGE_BUCKET);
  
  if (!bucketExists) {
    const { error: createError } = await getSupabaseAdmin().storage.createBucket(STORAGE_BUCKET, {
      public: false,
      fileSizeLimit: MAX_FILE_SIZE,
    });

    if (createError) {
      throw new Error(`Failed to create storage bucket: ${createError.message}`);
    }
  }
}

/**
 * Saves a file to Supabase Storage using deterministic path.
 * Path format: uploads/{conversation_id}/{document_id}/{filename}
 * 
 * @param buffer - File content as Buffer
 * @param conversationId - Conversation ID
 * @param documentId - Document ID
 * @param filename - Original filename
 * @returns Storage path
 * @throws Error if upload fails
 */
export async function saveDocumentFile(
  buffer: Buffer,
  conversationId: string,
  documentId: string,
  filename: string
): Promise<string> {
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  await ensureBucket();

  const storagePath = `${conversationId}/${documentId}/${filename}`;

  const { error: uploadError } = await getSupabaseAdmin().storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, buffer, {
      contentType: filename.endsWith('.pdf') ? 'application/pdf' : 'text/csv',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Failed to upload file to storage: ${uploadError.message}`);
  }

  return storagePath;
}

/**
 * Downloads a document file from Supabase Storage.
 * 
 * @param storagePath - Storage path of the file
 * @returns File content as Buffer
 * @throws Error if file not found or download fails
 */
export async function getDocumentFile(storagePath: string): Promise<Buffer> {
  const { data, error } = await getSupabaseAdmin().storage
    .from(STORAGE_BUCKET)
    .download(storagePath);

  if (error) {
    if (error.message.includes('not found')) {
      throw new Error(`Document file not found: ${storagePath}`);
    }
    throw new Error(`Failed to download file from storage: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Document file not found: ${storagePath}`);
  }

  return Buffer.from(await data.arrayBuffer());
}

/**
 * Deletes a document file from Supabase Storage.
 * Silently succeeds if file doesn't exist.
 * 
 * @param storagePath - Storage path of the file to delete
 * @throws Error if deletion fails (except when file not found)
 */
export async function deleteDocumentFile(storagePath: string): Promise<void> {
  const { error } = await getSupabaseAdmin().storage
    .from(STORAGE_BUCKET)
    .remove([storagePath]);

  if (error && !error.message.includes('not found')) {
    throw new Error(`Failed to delete file from storage: ${error.message}`);
  }
}

