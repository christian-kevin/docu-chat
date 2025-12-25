import { chunkPDF, chunkCSV } from '../chunking';
import type { ParsedPDF } from '../pdf';
import type { ParsedCSV } from '../csv';

const mockDocumentId = 'doc-test-123';
const mockConversationId = 'conv-test-456';

describe('chunkPDF', () => {
  it('should chunk PDF into sequential chunks with database format', () => {
    const parsedPDF: ParsedPDF = {
      type: 'pdf',
      pages: [
        {
          pageNumber: 1,
          text: 'This is paragraph one.\n\nThis is paragraph two.\n\nThis is paragraph three.',
        },
      ],
    };

    const chunks = chunkPDF(parsedPDF, mockDocumentId, mockConversationId);

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].id).toBeDefined();
    expect(chunks[0].document_id).toBe(mockDocumentId);
    expect(chunks[0].conversation_id).toBe(mockConversationId);
    expect(chunks[0].chunk_index).toBe(0);
    expect(chunks[0].content).toBeDefined();
    expect(chunks[0].embedding).toBeNull();
    expect(chunks[0].created_at).toBeDefined();
    expect(chunks[0].metadata?.pageNumber).toBe(1);
    expect(chunks[0].metadata).not.toBeNull();
  });

  it('should maintain sequential chunk_index', () => {
    const parsedPDF: ParsedPDF = {
      type: 'pdf',
      pages: [
        {
          pageNumber: 1,
          text: 'Paragraph one.\n\nParagraph two.\n\nParagraph three.\n\nParagraph four.',
        },
      ],
    };

    const chunks = chunkPDF(parsedPDF, mockDocumentId, mockConversationId);

    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].chunk_index).toBe(i);
      expect(chunks[i].document_id).toBe(mockDocumentId);
      expect(chunks[i].conversation_id).toBe(mockConversationId);
    }
  });

  it('should handle multiple pages', () => {
    const parsedPDF: ParsedPDF = {
      type: 'pdf',
      pages: [
        { pageNumber: 1, text: 'Page one content.\n\nMore content.' },
        { pageNumber: 2, text: 'Page two content.\n\nMore content.' },
      ],
    };

    const chunks = chunkPDF(parsedPDF, mockDocumentId, mockConversationId);

    expect(chunks.length).toBeGreaterThan(0);
    const page1Chunks = chunks.filter(c => c.metadata?.pageNumber === 1);
    const page2Chunks = chunks.filter(c => c.metadata?.pageNumber === 2);
    expect(page1Chunks.length).toBeGreaterThan(0);
    expect(page2Chunks.length).toBeGreaterThan(0);
    
    chunks.forEach(chunk => {
      expect(chunk.document_id).toBe(mockDocumentId);
      expect(chunk.conversation_id).toBe(mockConversationId);
    });
  });

  it('should preserve paragraph boundaries', () => {
    const parsedPDF: ParsedPDF = {
      type: 'pdf',
      pages: [
        {
          pageNumber: 1,
          text: 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.',
        },
      ],
    };

    const chunks = chunkPDF(parsedPDF, mockDocumentId, mockConversationId);
    const content = chunks.map(c => c.content).join('\n\n');

    expect(content).toContain('First paragraph');
    expect(content).toContain('Second paragraph');
    expect(content).toContain('Third paragraph');
  });
});

describe('chunkCSV', () => {
  it('should create one chunk per row with database format', () => {
    const parsedCSV: ParsedCSV = {
      type: 'csv',
      rows: [
        { rowIndex: 1, serializedText: 'This record describes a product. Name: item1. Price: 100.' },
        { rowIndex: 2, serializedText: 'This record describes a product. Name: item2. Price: 200.' },
        { rowIndex: 3, serializedText: 'This record describes a product. Name: item3. Price: 300.' },
      ],
    };

    const chunks = chunkCSV(parsedCSV, mockDocumentId, mockConversationId);

    expect(chunks.length).toBe(3);
    expect(chunks[0].id).toBeDefined();
    expect(chunks[0].document_id).toBe(mockDocumentId);
    expect(chunks[0].conversation_id).toBe(mockConversationId);
    expect(chunks[0].chunk_index).toBe(0);
    expect(chunks[1].chunk_index).toBe(1);
    expect(chunks[2].chunk_index).toBe(2);
    expect(chunks[0].embedding).toBeNull();
    expect(chunks[0].created_at).toBeDefined();
  });

  it('should preserve row metadata', () => {
    const parsedCSV: ParsedCSV = {
      type: 'csv',
      rows: [
        { rowIndex: 1, serializedText: 'Test content' },
      ],
    };

    const chunks = chunkCSV(parsedCSV, mockDocumentId, mockConversationId);

    expect(chunks[0].metadata?.rowIndex).toBe(1);
    expect(chunks[0].metadata).not.toBeNull();
    expect(chunks[0].content).toBe('Test content');
    expect(chunks[0].document_id).toBe(mockDocumentId);
    expect(chunks[0].conversation_id).toBe(mockConversationId);
  });

  it('should maintain sequential chunk_index', () => {
    const parsedCSV: ParsedCSV = {
      type: 'csv',
      rows: Array.from({ length: 5 }, (_, i) => ({
        rowIndex: i + 1,
        serializedText: `Row ${i + 1} content`,
      })),
    };

    const chunks = chunkCSV(parsedCSV, mockDocumentId, mockConversationId);

    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].chunk_index).toBe(i);
      expect(chunks[i].document_id).toBe(mockDocumentId);
      expect(chunks[i].conversation_id).toBe(mockConversationId);
    }
  });

  it('should handle empty CSV', () => {
    const parsedCSV: ParsedCSV = {
      type: 'csv',
      rows: [],
    };

    const chunks = chunkCSV(parsedCSV, mockDocumentId, mockConversationId);
    expect(chunks.length).toBe(0);
  });
});
