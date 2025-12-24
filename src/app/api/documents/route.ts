import { NextRequest, NextResponse } from 'next/server';
import type { UploadDocumentResponse, DocumentListResponse } from '@/types/api';

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

    // Validate file type
    const allowedTypes = ['application/pdf', 'text/csv', 'application/vnd.ms-excel', 'text/plain'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PDF and CSV files are supported.' },
        { status: 400 }
      );
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }

    // TODO: Implement document upload logic
    // 1. Generate unique document ID
    // 2. Upload file to storage (Supabase Storage)
    // 3. Create document record in database
    // 4. Trigger document processing pipeline
    // 5. Return document ID and initial status

    const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Placeholder response - replace with actual implementation
    const response: UploadDocumentResponse = {
      document_id: documentId,
      status: 'processing'
    };

    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    console.error('Error uploading document:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
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

    // TODO: Implement document listing logic
    // 1. Validate conversation exists
    // 2. Query documents for the conversation
    // 3. Return formatted document list

    // Placeholder response - replace with actual implementation
    const response: DocumentListResponse = {
      documents: [
        {
          id: 'doc_placeholder_1',
          filename: 'sample.pdf',
          file_type: 'pdf',
          status: 'ready',
          created_at: new Date().toISOString()
        }
      ]
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