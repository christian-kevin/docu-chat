import { randomUUID } from 'crypto';
import { getSupabaseAdmin } from '@/lib/database/client';
import { MAX_FILE_SIZE } from '@/lib/documents/validation';

const STORAGE_BUCKET = 'temp-uploads';
const MAX_FILES = 10;

interface TempFileInfo {
  path: string;
  createdAt: Date;
}

/**
 * Ensures the temporary uploads storage bucket exists in Supabase Storage.
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
 * Retrieves all temporary files from storage, sorted by creation date (oldest first).
 * Returns empty array if bucket doesn't exist or has no files.
 */
async function getTempFiles(): Promise<TempFileInfo[]> {
  try {
    const { data: files, error } = await getSupabaseAdmin().storage
      .from(STORAGE_BUCKET)
      .list('', {
        sortBy: { column: 'created_at', order: 'asc' },
      });

    if (error) {
      throw error;
    }

    if (!files) {
      return [];
    }

    return files
      .filter(file => file.id)
      .map(file => ({
        path: file.name,
        createdAt: new Date(file.created_at || Date.now()),
      }))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return [];
    }
    throw error;
  }
}

/**
 * Removes oldest temporary files when the total count exceeds MAX_FILES limit.
 * Keeps the most recent files and deletes the rest to maintain the limit.
 */
async function cleanupOldFiles(): Promise<void> {
  const files = await getTempFiles();
  
  if (files.length >= MAX_FILES) {
    const filesToDelete = files.slice(0, files.length - MAX_FILES + 1);
    
    for (const file of filesToDelete) {
      try {
        const { error } = await getSupabaseAdmin().storage
          .from(STORAGE_BUCKET)
          .remove([file.path]);

        if (error) {
          console.warn(`Failed to delete old temp file ${file.path}:`, error);
        }
      } catch (error) {
        console.warn(`Failed to delete old temp file ${file.path}:`, error);
      }
    }
  }
}

/**
 * Saves a file buffer to Supabase Storage as a temporary file.
 * Generates a unique filename with original extension and enforces file size limit.
 * Automatically cleans up old files to maintain MAX_FILES limit.
 * 
 * @param buffer - File content as Buffer
 * @param originalFilename - Original filename to extract extension
 * @returns Storage path of the uploaded file
 * @throws Error if file exceeds size limit or upload fails
 */
export async function saveTempFile(
  buffer: Buffer,
  originalFilename: string
): Promise<string> {
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  await ensureBucket();

  const extension = originalFilename.split('.').pop() || '';
  const filename = `${randomUUID()}.${extension}`;
  const filePath = `${filename}`;

  const { error: uploadError } = await getSupabaseAdmin().storage
    .from(STORAGE_BUCKET)
    .upload(filePath, buffer, {
      contentType: originalFilename.endsWith('.pdf') ? 'application/pdf' : 'text/csv',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Failed to upload file to storage: ${uploadError.message}`);
  }

  await cleanupOldFiles();

  return filePath;
}

/**
 * Downloads a temporary file from Supabase Storage by its path.
 * 
 * @param filePath - Storage path of the file to download
 * @returns File content as Buffer
 * @throws Error if file not found or download fails
 */
export async function getTempFile(filePath: string): Promise<Buffer> {
  const { data, error } = await getSupabaseAdmin().storage
    .from(STORAGE_BUCKET)
    .download(filePath);

  if (error) {
    if (error.message.includes('not found')) {
      throw new Error(`Temp file not found: ${filePath}`);
    }
    throw new Error(`Failed to download file from storage: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Temp file not found: ${filePath}`);
  }

  return Buffer.from(await data.arrayBuffer());
}

/**
 * Deletes a temporary file from Supabase Storage.
 * Silently succeeds if file doesn't exist.
 * 
 * @param filePath - Storage path of the file to delete
 * @throws Error if deletion fails (except when file not found)
 */
export async function deleteTempFile(filePath: string): Promise<void> {
  const { error } = await getSupabaseAdmin().storage
    .from(STORAGE_BUCKET)
    .remove([filePath]);

  if (error && !error.message.includes('not found')) {
    throw new Error(`Failed to delete file from storage: ${error.message}`);
  }
}

/**
 * Deletes all temporary files from storage bucket.
 * Used for cleanup operations. Silently succeeds if bucket doesn't exist.
 */
export async function cleanupAllTempFiles(): Promise<void> {
  try {
    const files = await getTempFiles();
    const filePaths = files.map(file => file.path);
    
    if (filePaths.length > 0) {
      const { error } = await getSupabaseAdmin().storage
        .from(STORAGE_BUCKET)
        .remove(filePaths);

      if (error) {
        throw error;
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return;
    }
    throw error;
  }
}
