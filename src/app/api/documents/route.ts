import { NextRequest, NextResponse } from 'next/server';
import type { UploadDocumentResponse, DocumentListResponse } from '@/types/api';
import { validateDocument } from '@/lib/documents/validation';
import { createDocument, getDocumentsByConversation } from '@/lib/documents/service';
import { processDocument } from '@/lib/documents/processing';

// POST /api/documents
// Uploads a document and creates document record
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as globalThis.File;
    const conversationId = formData.get('conversation_id') as string;

    if (!file || !conversationId) {
      return NextResponse.json(
        { error: 'Missing required fields: file and conversation_id' },
        { status: 400 }
      );
    }

    const validation = await validateDocument(file);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    console.log(`[API] Creating document for conversation: ${conversationId}, filename: ${file.name}, size: ${file.size}`);
    const result = await createDocument({ file, conversationId });
    console.log(`[API] Document created: ${result.documentId}, status: ${result.status}`);

    console.log(`[API] Starting async processing for document: ${result.documentId}`);
    processDocument(result.documentId).catch((error) => {
      console.error(`[API] Failed to process document ${result.documentId}:`, error);
      console.error(`[API] Error details:`, {
        message: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : 'Unknown',
        stack: error instanceof Error ? error.stack?.substring(0, 1000) : 'No stack trace',
      });
    });

    const response: UploadDocumentResponse = {
      document_id: result.documentId,
      status: result.status
    };

    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    console.error('Error uploading document:', error);
    
    // Handle specific error for existing document
    if (error instanceof Error && error.message.includes('Conversation already has a document')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/documents
// Lists documents for a conversation
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

    const documents = await getDocumentsByConversation(conversationId);

    const response: DocumentListResponse = {
      documents: documents.map(doc => ({
        id: doc.id,
        filename: doc.filename,
        file_type: doc.file_type,
        status: doc.status === 'processing' ? 'processing' : doc.status === 'ready' ? 'ready' : doc.status === 'uploading' ? 'uploading' : 'failed',
        created_at: doc.created_at,
      })),
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Error listing documents:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}