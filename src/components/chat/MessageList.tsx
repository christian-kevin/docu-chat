'use client';

import { Message } from './ChatInterface';
import { DocumentStatus } from './DocumentStatus';

interface MessageListProps {
  messages: Message[];
  uploadedDocuments: Map<string, string>;
  conversationId: string | null;
  onDocumentStatusChange?: (status: 'uploading' | 'processing' | 'ready' | 'failed') => void;
  isLoading?: boolean;
  isSendingMessage?: boolean;
  isUploadingDocument?: boolean;
  isProcessingDocument?: boolean;
}

export function MessageList({ messages, uploadedDocuments, conversationId, onDocumentStatusChange, isLoading, isSendingMessage, isUploadingDocument, isProcessingDocument }: MessageListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <svg className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <p className="text-gray-400">Loading messages...</p>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <p>Start a conversation by uploading a document or asking a question</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {messages.map((message) => {
        if (message.role === 'system') {
          return (
            <div key={message.id} className="flex justify-center">
              <div className="bg-gray-800 text-gray-400 text-sm rounded-lg px-4 py-2 max-w-[70%]">
                <p className="whitespace-pre-wrap">{message.content}</p>
                <p className="text-xs mt-1 opacity-70">
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        }

        return (
          <div
            key={message.id}
            className={`flex gap-3 ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {message.role === 'assistant' && (
              <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
            )}

            <div
              className={`max-w-[70%] rounded-lg px-4 py-2 ${
                message.role === 'user'
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-800 text-gray-100'
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
              {message.documentId && conversationId && (
                <div className="mt-2 pt-2 border-t border-gray-700">
                  <DocumentStatus
                    documentId={message.documentId}
                    filename={uploadedDocuments.get(message.documentId) || 'Document'}
                    onStatusChange={onDocumentStatusChange}
                  />
                </div>
              )}
              <p className="text-xs mt-2 opacity-70">
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>

            {message.role === 'user' && (
              <div className="w-8 h-8 bg-teal-600 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            )}
          </div>
        );
      })}
      {isUploadingDocument && (
        <div className="flex justify-center">
          <div className="bg-gray-800 text-gray-400 text-sm rounded-lg px-4 py-2">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Uploading document...</span>
            </div>
          </div>
        </div>
      )}
      {isProcessingDocument && !isUploadingDocument && (
        <div className="flex justify-center">
          <div className="bg-gray-800 text-gray-400 text-sm rounded-lg px-4 py-2">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Processing document...</span>
            </div>
          </div>
        </div>
      )}
      {isSendingMessage && (
        <div className="flex gap-3 justify-start">
          <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div className="bg-gray-800 text-gray-100 rounded-lg px-4 py-2 max-w-[70%]">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="text-sm text-gray-400">Thinking...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

