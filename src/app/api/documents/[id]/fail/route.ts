export const runtime = 'nodejs';
export const maxDuration = 10;

import { NextRequest, NextResponse } from 'next/server';
import { markDocumentFailed } from '@/lib/database/queries/document';

export async function POST(
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

    await markDocumentFailed(documentId, 'Manually marked as failed by user');

    return NextResponse.json(
      { status: 'failed' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error marking document as failed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

