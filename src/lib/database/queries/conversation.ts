import { getSupabaseAdmin } from '../client';
import type { Conversation } from '../schema';

export async function createConversation(): Promise<string> {
  const { data, error } = await getSupabaseAdmin()
    .from('conversations')
    .insert({})
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create conversation: ${error.message}`);
  }

  if (!data) {
    throw new Error('Failed to create conversation: no data returned');
  }

  return data.id;
}

export async function getConversations(): Promise<Conversation[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('conversations')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch conversations: ${error.message}`);
  }

  return (data || []) as Conversation[];
}

export async function softDeleteConversation(conversationId: string): Promise<void> {
  const { data, error } = await getSupabaseAdmin()
    .from('conversations')
    .update({
      deleted_at: new Date().toISOString(),
    })
    .eq('id', conversationId)
    .is('deleted_at', null)
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to soft delete conversation: ${error.message}`);
  }

  if (!data) {
    throw new Error('Conversation not found or already deleted');
  }
}

