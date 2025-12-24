export interface UploadDocumentRequest {
  file: globalThis.File;
  conversation_id: string;
}

export interface UploadDocumentResponse {
  document_id: string;
  status: 'processing' | 'completed' | 'failed';
}

export interface ChatRequest {
  conversation_id: string;
  message: string;
}

export interface ChatSource {
  document_id: string;
  chunk_id: string;
  similarity: number;
}

export interface ChatResponse {
  answer: string;
  sources: ChatSource[];
}

export interface CreateConversationResponse {
  conversation_id: string;
}

export interface DeleteConversationResponse {
  status: 'deleted';
}

export interface DocumentListItem {
  id: string;
  filename: string;
  file_type: 'pdf' | 'csv';
  status: 'processing' | 'ready' | 'failed';
  created_at: string;
}

export interface DocumentListResponse {
  documents: DocumentListItem[];
}

export interface DocumentMetadataResponse {
  id: string;
  conversation_id: string;
  filename: string;
  file_type: 'pdf' | 'csv';
  status: 'processing' | 'ready' | 'failed';
  created_at: string;
}

export interface ChatHistoryMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export interface ChatHistoryResponse {
  messages: ChatHistoryMessage[];
}

export interface ConversationListItem {
  id: string;
  created_at: string;
}

export interface ConversationListResponse {
  conversations: ConversationListItem[];
}