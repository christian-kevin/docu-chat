'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { ConversationList } from './ConversationList';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  documentId?: string;
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [uploadedDocuments, setUploadedDocuments] = useState<Map<string, string>>(new Map());
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMessageCountRef = useRef<number>(0);
  const [conversationListRefreshTrigger, setConversationListRefreshTrigger] = useState(0);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    if (!conversationId) {
      setMessages([]);
      setIsLoadingMessages(false);
      return;
    }

    setIsLoadingMessages(true);
    try {
      const response = await fetch(`/api/conversations/${conversationId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }
      const data = await response.json();
      const fetchedMessages: Message[] = data.messages.map((msg: any) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.created_at),
      }));
      setMessages(fetchedMessages);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [conversationId]);

  // Poll for new messages only when there are processing documents
  useEffect(() => {
    if (!conversationId) {
      lastMessageCountRef.current = 0;
      return;
    }

    // Initialize message count when conversation changes
    lastMessageCountRef.current = messages.length;

    let pollingActive = true;
    let interval: NodeJS.Timeout | null = null;

    const checkForNewMessages = async () => {
      if (!pollingActive) return;

      try {
        // Check if there are any processing documents
        const docsResponse = await fetch(`/api/documents?conversation_id=${conversationId}`);
        if (!docsResponse.ok) {
          pollingActive = false;
          if (interval) clearInterval(interval);
          return;
        }

        const docsData = await docsResponse.json();
        const hasProcessingDocs = docsData.documents?.some(
          (doc: any) => doc.status === 'processing' || doc.status === 'uploading'
        );

        // Fetch messages to check for completion message
        const messagesResponse = await fetch(`/api/conversations/${conversationId}`);
        if (messagesResponse.ok) {
          const messagesData = await messagesResponse.json();
          const fetchedMessages: Message[] = messagesData.messages.map((msg: any) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            timestamp: new Date(msg.created_at),
          }));

          const currentMessageCount = fetchedMessages.length;
          const lastCount = lastMessageCountRef.current;
          
          // Check if we have a completion message
          const hasCompletionMessage = fetchedMessages.some(
            (msg) => msg.role === 'system' && 
              (msg.content.includes('processing completed') || msg.content.includes('processing failed'))
          );

          // If we have new messages, update the UI
          if (currentMessageCount !== lastCount) {
            setMessages(fetchedMessages);
            lastMessageCountRef.current = currentMessageCount;
          }

          // Stop polling if no processing docs AND we have completion message
          if (!hasProcessingDocs && hasCompletionMessage) {
            pollingActive = false;
            if (interval) clearInterval(interval);
            return;
          }

          // Continue polling if there are still processing docs OR we haven't seen completion message yet
          // This handles the race condition where processing finishes but message isn't created yet
        }
      } catch (error) {
        console.error('Error polling for messages:', error);
      }
    };

    // Check once to see if we should start polling
    const startPollingIfNeeded = async () => {
      const docsResponse = await fetch(`/api/documents?conversation_id=${conversationId}`);
      if (docsResponse.ok) {
        const docsData = await docsResponse.json();
        const hasProcessingDocs = docsData.documents?.some(
          (doc: any) => doc.status === 'processing' || doc.status === 'uploading'
        );
        
        // Check if we already have a completion message
        const messagesResponse = await fetch(`/api/conversations/${conversationId}`);
        if (messagesResponse.ok) {
          const messagesData = await messagesResponse.json();
          const hasCompletionMessage = messagesData.messages?.some(
            (msg: any) => msg.role === 'system' && 
              (msg.content.includes('processing completed') || msg.content.includes('processing failed'))
          );

          // Start polling if there are processing docs OR if we haven't seen completion message yet
          // This ensures we catch the completion message even if processing just finished
          if (hasProcessingDocs || !hasCompletionMessage) {
            checkForNewMessages();
            interval = setInterval(checkForNewMessages, 2000);
          }
        }
      }
    };

    startPollingIfNeeded();

    return () => {
      pollingActive = false;
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [conversationId]);

  const handleStartChat = async () => {
    if (isCreatingConversation) return;
    
    setIsCreatingConversation(true);
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to create conversation');
      }
      const data = await response.json();
      setConversationId(data.conversation_id);
      setMessages([]);
      setUploadedDocuments(new Map());
      // Refresh conversation list to show the new chat
      setConversationListRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Failed to create conversation:', error);
      alert('Failed to start chat. Please try again.');
    } finally {
      setIsCreatingConversation(false);
    }
  };

  const handleSelectConversation = (id: string) => {
    // Only update if it's a different conversation
    if (conversationId !== id) {
      setConversationId(id);
      setMessages([]);
      setUploadedDocuments(new Map());
    }
  };

  const handleDeleteConversation = (id: string) => {
    if (conversationId === id) {
      setConversationId(null);
      setMessages([]);
      setUploadedDocuments(new Map());
    }
  };

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
        const errorMessage = error.error || 'Upload failed';
        
        // Show user-friendly error message
        alert(errorMessage);
        return;
      }

      const data = await response.json();
      const documentId = data.document_id;

      setUploadedDocuments((prev) => new Map(prev).set(documentId, file.name));

      // Refresh messages from database to get system messages for document upload
      const messagesResponse = await fetch(`/api/conversations/${conversationId}`);
      if (messagesResponse.ok) {
        const messagesData = await messagesResponse.json();
        const fetchedMessages: Message[] = messagesData.messages.map((msg: any) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.created_at),
        }));
        setMessages(fetchedMessages);
        // Trigger polling to start by updating message count ref
        lastMessageCountRef.current = fetchedMessages.length;
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert(error instanceof Error ? error.message : 'Failed to upload document');
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || !conversationId || isSendingMessage) return;

    setIsSendingMessage(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          message: content,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send message');
      }

      // Refresh messages from database to get the saved messages
      const messagesResponse = await fetch(`/api/conversations/${conversationId}`);
      if (messagesResponse.ok) {
        const messagesData = await messagesResponse.json();
        const fetchedMessages: Message[] = messagesData.messages.map((msg: any) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.created_at),
        }));
        setMessages(fetchedMessages);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert(error instanceof Error ? error.message : 'Failed to send message');
    } finally {
      setIsSendingMessage(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      <div className="w-64 border-r border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold">DocuChat</h1>
            </div>
          </div>
          <button
            onClick={handleStartChat}
            disabled={isCreatingConversation}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {isCreatingConversation ? 'Starting...' : '+ New Chat'}
          </button>
        </div>
        <ConversationList
          onSelectConversation={handleSelectConversation}
          selectedConversationId={conversationId}
          onDeleteConversation={handleDeleteConversation}
          refreshTrigger={conversationListRefreshTrigger}
        />
      </div>

      <div className="flex-1 flex flex-col">
        <header className="flex items-center justify-between p-4 border-b border-gray-800">
          <div>
            <h2 className="text-lg font-semibold">AI-powered document analysis</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm text-gray-400">Online</span>
          </div>
        </header>

        {!conversationId ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-gray-400 mb-4">Start a new conversation to begin</p>
              <button
                onClick={handleStartChat}
                disabled={isCreatingConversation}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                {isCreatingConversation ? 'Starting...' : 'Start Chat'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto">
              <MessageList
                messages={messages}
                uploadedDocuments={uploadedDocuments}
                conversationId={conversationId}
                onDocumentStatusChange={() => {
                  // Add a small delay to ensure the completion message is created
                  setTimeout(() => {
                    fetchMessages();
                  }, 500);
                }}
                isLoading={isLoadingMessages}
                isSendingMessage={isSendingMessage}
              />
              <div ref={messagesEndRef} />
            </div>

            <MessageInput
              onSend={handleSendMessage}
              onDocumentUpload={handleDocumentUpload}
              disabled={isSendingMessage}
            />
          </>
        )}
      </div>
    </div>
  );
}

