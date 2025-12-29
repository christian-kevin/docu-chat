import { NextRequest, NextResponse } from 'next/server';
import type { ChatRequest, ChatResponse, ChatHistoryResponse } from '@/types/api';
import { getConversationById } from '@/lib/database/queries/conversation';
import { createMessage } from '@/lib/database/queries/message';
import { selectDocumentsByConversation } from '@/lib/database/queries/document';
import { getSemanticCache, setSemanticCache } from '@/lib/database/queries/semantic-cache';
import { searchDocumentChunks } from '@/lib/database/queries/vector-search';
import { embedQuery } from '@/lib/ai/embeddings';
import { openrouterClient } from '@/lib/ai/openrouter-client';
import { createHash } from 'crypto';

function hashQuery(query: string, documentIds: string[], model: string, temperature: number, matchCount: number): string {
  const data = `${query}|${model}|${temperature}|${matchCount}|${JSON.stringify(documentIds.sort())}`;
  return createHash('sha256').update(data).digest('hex');
}

// POST /api/chat
// Processes a chat message and returns AI response with sources
export async function POST(request: NextRequest) {
  console.error("🔥 CHAT ROUTE HIT DEV + DEPLOY");
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

    const documents = await selectDocumentsByConversation(conversation_id);
    const readyDocuments = documents.filter(doc => doc.status === 'ready');
    
    console.log('[chat] Documents found:', { total: documents.length, ready: readyDocuments.length });
    
    if (readyDocuments.length === 0) {
      const answer = 'Please upload a document first to ask questions about it.';
      
      await createMessage({
        conversation_id,
        role: 'assistant',
        content: answer,
      });

      return NextResponse.json({
        answer,
        sources: [],
      }, { status: 200 });
    }

    const documentIds = readyDocuments.map(doc => doc.id);
    const model = 'mistralai/mistral-7b-instruct';
    const temperature = 0;
    const matchCount = 15;
    const matchThreshold = 0.3;

    const queryHash = hashQuery(message, documentIds, model, temperature, matchCount);
    const cachedResponse = await getSemanticCache(queryHash);
    
    console.log('[chat] Cache check:', { hasCache: !!cachedResponse, queryHash: queryHash.substring(0, 8) + '...' });
    
    if (cachedResponse) {
      await createMessage({
        conversation_id,
        role: 'assistant',
        content: cachedResponse,
      });

      return NextResponse.json({
        answer: cachedResponse,
        sources: [],
      }, { status: 200 });
    }

    console.log('[chat] Starting vector search...');
    const queryEmbedding = await embedQuery(message);
    console.log('[chat] Query embedding generated, length:', queryEmbedding.length);
    
    const searchResults = await searchDocumentChunks({
      queryEmbedding,
      conversationId: conversation_id,
      matchThreshold,
      matchCount,
      includeSimilarity: true,
    });

    console.log('[chat] Search results:', JSON.stringify({
      count: searchResults.length,
      results: searchResults.map(r => ({
        id: r.id,
        document_id: r.document_id,
        similarity: r.similarity,
        content_preview: r.content.slice(0, 100) + '...'
      }))
    }, null, 2));

    const context = searchResults
      .map(result => result.content.slice(0, 800))
      .join('\n\n')
      .slice(0, 4000);
    
    let answer: string;
    if (searchResults.length === 0) {
      answer = 'I couldn\'t find relevant information in the document to answer your question.';
    } else {
      const systemPrompt = `You are a helpful assistant that answers questions based on the provided document context.
Answer the user's question using only the information from the context below.
If the context doesn't contain enough information to answer the question, say so.
Be concise and accurate.`;

      const userPrompt = `Context from document:
${context}

User question: ${message}

Answer the question based on the context above:`;

      try {
        const response = await openrouterClient.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature,
          max_tokens: 512,
        });

        answer = response.choices[0]?.message?.content?.trim() || 'I apologize, but I couldn\'t generate a response.';
      } catch (error) {
        console.error('LLM error:', error);
        answer = `Based on the document context, here's what I found:\n\n${context.substring(0, 500)}${context.length > 500 ? '...' : ''}`;
      }
    }

    try {
      await setSemanticCache(queryHash, answer);
    } catch (error) {
      console.error('Failed to save semantic cache:', error);
    }

    await createMessage({
      conversation_id,
      role: 'assistant',
      content: answer,
    });

    const response: ChatResponse = {
      answer,
      sources: searchResults.map(result => ({
        document_id: result.document_id,
        chunk_id: result.id,
        similarity: result.similarity,
      })),
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