'use client';

import { useState, useEffect } from 'react';

export interface Conversation {
  id: string;
  created_at: string;
}

interface ConversationListProps {
  onSelectConversation: (conversationId: string) => void;
  selectedConversationId: string | null;
  onDeleteConversation?: (conversationId: string) => void;
  refreshTrigger?: number;
}

export function ConversationList({ onSelectConversation, selectedConversationId, onDeleteConversation, refreshTrigger }: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchConversations = async () => {
    try {
      const response = await fetch('/api/conversations');
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      }
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [refreshTrigger]);

  const handleDelete = async (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this conversation?')) {
      return;
    }

    setDeletingId(conversationId);
    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete conversation');
      }

      if (onDeleteConversation) {
        onDeleteConversation(conversationId);
      }
      
      await fetchConversations();
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      alert('Failed to delete conversation');
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 text-gray-400 text-sm">Loading conversations...</div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="p-4 text-gray-400 text-sm">No conversations yet</div>
    );
  }

  return (
    <div className="border-b border-gray-800">
      <div className="p-2 text-xs text-gray-500 uppercase tracking-wide px-4 py-2">
        Conversations
      </div>
      <div className="max-h-64 overflow-y-auto">
        {conversations.map((conv) => (
          <div
            key={conv.id}
            className={`group flex items-center justify-between hover:bg-gray-800 transition-colors ${
              selectedConversationId === conv.id ? 'bg-gray-800 border-l-2 border-blue-600' : ''
            }`}
          >
            <button
              onClick={() => onSelectConversation(conv.id)}
              className="flex-1 text-left px-4 py-2 text-sm"
            >
              <div className="truncate">
                {new Date(conv.created_at).toLocaleDateString()} {new Date(conv.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </button>
            <button
              onClick={(e) => handleDelete(e, conv.id)}
              disabled={deletingId === conv.id}
              className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-400 disabled:opacity-50 transition-opacity"
              title="Delete conversation"
            >
              {deletingId === conv.id ? (
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

