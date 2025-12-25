import { NextRequest, NextResponse } from 'next/server';
import type { ChatRequest, ChatResponse, ChatHistoryResponse } from '@/types/api';
import { getConversationById } from '@/lib/database/queries/conversation';
import { createMessage } from '@/lib/database/queries/message';

export const runtime = 'nodejs';
export const maxDuration = 10;

// POST /api/chat
// Processes a chat message and returns AI response with sources
export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { conversation_id, message } = body;

    if (!conversation_id || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: conversation_id and message' },
        { status: 400 }
      );
    }

    const conversation = await getConversationById(conversation_id);
    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    await createMessage({
      conversation_id,
      role: 'user',
      content: message,
    });

    // TODO: Implement full chat logic
    // 3. Perform vector search on document chunks
    // 4. Generate AI response using retrieved context
    // 5. Save assistant message to database
    // 6. Return response with sources

    // Placeholder response - replace with actual implementation
    const answer = `This is a placeholder response for message: "${message}"`;
    
    await createMessage({
      conversation_id,
      role: 'assistant',
      content: answer,
    });

    const response: ChatResponse = {
      answer,
      sources: [
        {
          document_id: 'doc_placeholder_1',
          chunk_id: 'chunk_placeholder_1',
          similarity: 0.85
        }
      ]
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Error processing chat:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/chat
// Gets chat history for a conversation
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new globalThis.URL(request.url);
    const conversationId = searchParams.get('conversation_id');

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Missing required query parameter: conversation_id' },
        { status: 400 }
      );
    }

    const conversation = await getConversationById(conversationId);
    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    const { getMessagesByConversation } = await import('@/lib/database/queries/message');
    const messages = await getMessagesByConversation(conversationId);

    const response: ChatHistoryResponse = {
      messages: messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        created_at: msg.created_at,
      })),
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Error getting chat history:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}