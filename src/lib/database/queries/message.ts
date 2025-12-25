import { getSupabaseAdmin } from '../client';
import type { Message } from '../schema';

export async function getMessagesByConversation(conversationId: string): Promise<Message[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch messages: ${error.message}`);
  }

  return (data || []) as Message[];
}

export async function createMessage(params: {
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}): Promise<string> {
  const { data, error } = await getSupabaseAdmin()
    .from('messages')
    .insert({
      conversation_id: params.conversation_id,
      role: params.role,
      content: params.content,
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create message: ${error.message}`);
  }

  if (!data) {
    throw new Error('Failed to create message: no data returned');
  }

  return data.id;
}

