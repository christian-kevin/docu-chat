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

export interface DeleteConversationResponse {}