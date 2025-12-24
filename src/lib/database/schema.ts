export interface Conversation {
  id: string
  created_at: string
}

export interface Document {
  id: string
  conversation_id: string
  filename: string
  file_type: 'pdf' | 'csv'
  status: 'processing' | 'completed' | 'failed'
  created_at: string
}

export interface DocumentChunk {
  id: string
  document_id: string
  conversation_id: string
  chunk_index: number
  content: string
  embedding: number[]
  created_at: string
}

export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
}
