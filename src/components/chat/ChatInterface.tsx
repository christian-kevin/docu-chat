'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  documentId?: string;
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [uploadedDocuments, setUploadedDocuments] = useState<Map<string, string>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const createConversation = async () => {
      try {
        const response = await fetch('/api/conversations', {
          method: 'POST',
        });
        const data = await response.json();
        setConversationId(data.conversation_id);
      } catch (error) {
        console.error('Failed to create conversation:', error);
      }
    };
    createConversation();
  }, []);

  const handleDocumentUpload = async (file: File) => {
    if (!conversationId) return;

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('conversation_id', conversationId);

      const response = await fetch('/api/documents', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const data = await response.json();
      const documentId = data.document_id;

      setUploadedDocuments((prev) => new Map(prev).set(documentId, file.name));

      const userMessage: Message = {
        id: `msg-${Date.now()}`,
        role: 'user',
        content: `I've uploaded ${file.name}`,
        timestamp: new Date(),
        documentId,
      };

      setMessages((prev) => [...prev, userMessage]);
    } catch (error) {
      console.error('Upload error:', error);
      alert(error instanceof Error ? error.message : 'Failed to upload document');
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || !conversationId) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);

    // TODO: Implement chat API call
    const assistantMessage: Message = {
      id: `msg-${Date.now() + 1}`,
      role: 'assistant',
      content: 'This is a placeholder response. Chat functionality will be implemented next.',
      timestamp: new Date(),
    };

    setTimeout(() => {
      setMessages((prev) => [...prev, assistantMessage]);
    }, 500);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      <header className="flex items-center justify-between p-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-semibold">DocuChat</h1>
            <p className="text-sm text-gray-400">AI-powered document analysis</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span className="text-sm text-gray-400">Online</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <MessageList
          messages={messages}
          uploadedDocuments={uploadedDocuments}
          conversationId={conversationId}
        />
        <div ref={messagesEndRef} />
      </div>

      <MessageInput
        onSend={handleSendMessage}
        onDocumentUpload={handleDocumentUpload}
      />
    </div>
  );
}

