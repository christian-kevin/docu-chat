import { NextRequest, NextResponse } from 'next/server';
import type { DeleteConversationResponse, ChatHistoryResponse } from '@/types/api';
import { getConversationById, softDeleteConversation } from '@/lib/database/queries/conversation';
import { getMessagesByConversation } from '@/lib/database/queries/message';

// GET /api/conversations/[id]
// Gets a single conversation with all messages including document upload history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Conversation ID is required' },
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
    console.error('Error getting conversation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/conversations/[id]
// Deletes a conversation and all associated data
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Conversation ID is required' },
        { status: 400 }
      );
    }

    await softDeleteConversation(conversationId);

    const response: DeleteConversationResponse = {
      status: 'deleted'
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Error deleting conversation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
