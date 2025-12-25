import { NextRequest, NextResponse } from 'next/server';
import type { DocumentMetadataResponse } from '@/types/api';
import { getDocumentById } from '@/lib/documents/service';

// GET /api/documents/[id]
// Gets document metadata and ingestion status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params;

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      );
    }

    const document = await getDocumentById(documentId);

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    const response: DocumentMetadataResponse = {
      id: document.id,
      conversation_id: document.conversation_id,
      filename: document.filename,
      file_type: document.file_type,
      status: document.status === 'processing' ? 'processing' : document.status === 'completed' ? 'ready' : 'failed',
      created_at: document.created_at,
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Error getting document metadata:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
