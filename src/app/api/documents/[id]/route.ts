import { NextRequest, NextResponse } from 'next/server';
import type { DocumentMetadataResponse } from '@/types/api';

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

    // TODO: Implement document metadata retrieval logic
    // 1. Validate document exists
    // 2. Query document metadata from database
    // 3. Return formatted document metadata

    // Placeholder response - replace with actual implementation
    const response: DocumentMetadataResponse = {
      id: documentId,
      conversation_id: 'conv_placeholder_1',
      filename: 'sample.pdf',
      file_type: 'pdf',
      status: 'ready',
      created_at: new Date().toISOString()
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
