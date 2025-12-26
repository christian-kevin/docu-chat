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
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [isProcessingDocument, setIsProcessingDocument] = useState(false);
  const [hasReadyDocuments, setHasReadyDocuments] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [shouldPoll, setShouldPoll] = useState(false);
  const [pollingMessageCount, setPollingMessageCount] = useState(0);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const checkDocumentsReady = async () => {
    if (!conversationId) {
      setHasReadyDocuments(false);
      return;
    }
    try {
      const response = await fetch(`/api/documents?conversation_id=${conversationId}`);
      if (response.ok) {
        const data = await response.json();
        const readyDocs = data.documents?.filter((doc: any) => doc.status === 'ready') || [];
        setHasReadyDocuments(readyDocs.length > 0);
      }
    } catch (error) {
      console.error('Failed to check documents:', error);
    }
  };

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
    // Reset polling when conversation changes
    setShouldPoll(false);
    setPollingMessageCount(0);
    checkDocumentsReady();
  }, [conversationId]);

  // Simple polling: poll when shouldPoll is true, stop when message count increases
  useEffect(() => {
    if (!shouldPoll || !conversationId) {
      return;
    }

    let interval: NodeJS.Timeout | null = null;

    const checkMessages = async () => {
      try {
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
          
          // Check if completion message appeared
          const hasCompletionMessage = fetchedMessages.some(msg => 
            msg.role === 'system' && 
            (msg.content.includes('processing completed') || msg.content.includes('is ready'))
          );
          
          // Update messages
          setMessages(fetchedMessages);

          // If message count increased or completion message appeared, stop polling and processing
          if (currentMessageCount > pollingMessageCount || hasCompletionMessage) {
            console.log('[polling] Message count increased from', pollingMessageCount, 'to', currentMessageCount, '- stopping polling');
            setShouldPoll(false);
            setIsProcessingDocument(false);
            checkDocumentsReady();
            if (interval) {
              clearInterval(interval);
            }
          }
        }
      } catch (error) {
        console.error('[polling] Error polling messages:', error);
      }
    };

    // Poll every 2 seconds
    interval = setInterval(checkMessages, 2000);
    // Also check immediately
    checkMessages();

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [shouldPoll, conversationId, pollingMessageCount]);

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
      setShouldPoll(false);
      setPollingMessageCount(0);
      
      // Refresh conversation list
      if ((window as any).refreshConversationList) {
        (window as any).refreshConversationList();
      }
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

    setIsUploadingDocument(true);
    setIsProcessingDocument(true);
    
    // Add optimistic message immediately
    const optimisticMessage: Message = {
      id: `temp-upload-${Date.now()}`,
      role: 'system',
      content: `Document "${file.name}" uploaded and processing started.`,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, optimisticMessage]);
    
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
        
        // Remove optimistic message on error
        setMessages((prev) => prev.filter(msg => msg.id !== optimisticMessage.id));
        
        // Show user-friendly error message
        alert(errorMessage);
        setIsUploadingDocument(false);
        setIsProcessingDocument(false);
        return;
      }

      const data = await response.json();
      const documentId = data.document_id;

      setUploadedDocuments((prev) => new Map(prev).set(documentId, file.name));
      setIsUploadingDocument(false);

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
        
        // Start polling and set the message count to watch
        setPollingMessageCount(fetchedMessages.length);
        setShouldPoll(true);
        console.log('[upload] Started polling, watching for message count >', fetchedMessages.length);
      }
    } catch (error) {
      console.error('Upload error:', error);
      // Remove optimistic message on error
      setMessages((prev) => prev.filter(msg => msg.id !== optimisticMessage.id));
      alert(error instanceof Error ? error.message : 'Failed to upload document');
      setIsUploadingDocument(false);
      setIsProcessingDocument(false);
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || !conversationId || isSendingMessage) return;

    // Check if documents are ready before allowing chat
    if (!hasReadyDocuments) {
      alert('Please upload and wait for a document to finish processing before asking questions.');
      return;
    }

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
        // Update ready documents status
        await checkDocumentsReady();
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
                onDocumentStatusChange={(status) => {
                  // Update processing state and check documents
                  setIsProcessingDocument(status === 'processing');
                  if (status === 'ready' || status === 'failed') {
                    setIsProcessingDocument(false);
                    checkDocumentsReady();
                  }
                  // Add a small delay to ensure the completion message is created
                  setTimeout(() => {
                    fetchMessages();
                  }, 500);
                }}
                isLoading={isLoadingMessages}
                isSendingMessage={isSendingMessage}
                isUploadingDocument={isUploadingDocument}
                isProcessingDocument={isProcessingDocument}
              />
              <div ref={messagesEndRef} />
            </div>

            <MessageInput
              onSend={handleSendMessage}
              onDocumentUpload={handleDocumentUpload}
              disabled={isSendingMessage || isUploadingDocument || isProcessingDocument}
              isUploading={isUploadingDocument}
              isProcessing={isProcessingDocument}
              hasReadyDocuments={hasReadyDocuments}
            />
          </>
        )}
      </div>
    </div>
  );
}

