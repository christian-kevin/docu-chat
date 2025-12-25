import { NextRequest, NextResponse } from 'next/server';
import type { DeleteConversationResponse } from '@/types/api';
import { softDeleteConversation } from '@/lib/database/queries/conversation';

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
