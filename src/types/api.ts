export interface UploadDocumentResponse {
  document_id: string;
  status: 'uploading' | 'processing' | 'ready' | 'failed';
}

export interface DocumentListResponse {
  documents: Array<{
    id: string;
    filename: string;
    file_type: 'pdf' | 'csv';
    status: 'uploading' | 'processing' | 'ready' | 'failed';
    created_at: string;
  }>;
}

export interface DocumentMetadataResponse {
  id: string;
  conversation_id: string;
  filename: string;
  file_type: 'pdf' | 'csv';
  status: 'uploading' | 'processing' | 'ready' | 'failed';
  created_at: string;
}

export interface ChatRequest {
  conversation_id: string;
  message: string;
}

export interface ChatResponse {
  answer: string;
  sources: Array<{
    document_id: string;
    chunk_id: string;
    similarity: number;
  }>;
}

export interface ChatHistoryResponse {
  messages: Array<{
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    created_at: string;
  }>;
}

export interface ConversationResponse {
  conversation_id: string;
}

export interface CreateConversationResponse {
  conversation_id: string;
}

export interface ConversationListResponse {
  conversations: Array<{
    id: string;
    created_at: string;
  }>;
}

export interface DeleteConversationResponse {
  status: 'deleted';
}
