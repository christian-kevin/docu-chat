export interface Conversation {
  id: string
  created_at: string
  deleted_at: string | null
}

export interface Document {
  id: string
  conversation_id: string
  filename: string
  file_type: 'pdf' | 'csv'
  status: 'uploading' | 'processing' | 'ready' | 'failed'
  storage_path: string | null
  processing_started_at: string | null
  processing_attempts: number
  error_reason: string | null
  deleted_at: string | null
  created_at: string
}

export interface DocumentChunkMetadata {
  pageNumber?: number
  rowIndex?: number
}

export interface DocumentChunk {
  id: string
  document_id: string
  conversation_id: string
  chunk_index: number
  content: string
  embedding: number[] | null
  metadata: DocumentChunkMetadata | null
  created_at: string
}

export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
}
