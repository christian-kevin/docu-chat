import { NextResponse } from 'next/server';
import type { CreateConversationResponse, ConversationListResponse } from '@/types/api';
import { createConversation, getConversations } from '@/lib/database/queries/conversation';

// POST /api/conversations
// Creates a new conversation
export async function POST() {
  try {
    const conversationId = await createConversation();

    const response: CreateConversationResponse = {
      conversation_id: conversationId
    };

    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    console.error('Error creating conversation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/conversations
// Lists all conversations
export async function GET() {
  try {
    const conversations = await getConversations();

    const response: ConversationListResponse = {
      conversations: conversations.map(conv => ({
        id: conv.id,
        created_at: conv.created_at,
      })),
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Error listing conversations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}