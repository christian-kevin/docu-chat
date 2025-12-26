import { extractText, getDocumentProxy } from 'unpdf';

export interface ParsedPDFPage {
  pageNumber: number;
  text: string;
}

export interface ParsedPDF {
  type: 'pdf';
  pages: ParsedPDFPage[];
}

export class PDFParseError extends Error {
  public readonly code: 'INVALID_PDF' | 'ENCRYPTED_PDF' | 'EMPTY_TEXT';
  
  constructor(message: string, code: 'INVALID_PDF' | 'ENCRYPTED_PDF' | 'EMPTY_TEXT') {
    super(message);
    this.name = 'PDFParseError';
    this.code = code;
  }
}

export async function parsePDF(pdfBuffer: Buffer | ArrayBuffer): Promise<ParsedPDF> {
  const startTime = Date.now();
  console.log('[parsePDF] Starting PDF parsing, buffer size:', pdfBuffer instanceof ArrayBuffer ? pdfBuffer.byteLength : pdfBuffer.length);
  
  try {
    const buffer = pdfBuffer instanceof ArrayBuffer ? Buffer.from(pdfBuffer) : pdfBuffer;
    const uint8Array = new Uint8Array(buffer);
    
    console.log('[parsePDF] Creating document proxy...');
    const pdf = await getDocumentProxy(uint8Array);
    console.log('[parsePDF] Document proxy created, extracting text...');
    
    const { text } = await extractText(pdf, { mergePages: false });
    console.log('[parsePDF] Text extracted, pages:', text?.length || 0);

    if (!text || text.length === 0) {
      console.error('[parsePDF] No text extracted from PDF');
      throw new PDFParseError('PDF contains no extractable text', 'EMPTY_TEXT');
    }

    const parsedPages = text
      .map((pageText: string, i: number) => ({
        pageNumber: i + 1,
        text: pageText.replace(/\s+/g, ' ').trim(),
      }))
      .filter((page: { pageNumber: number; text: string }) => page.text.length > 0);

    if (parsedPages.length === 0) {
      console.error('[parsePDF] No pages with text after processing');
      throw new PDFParseError('PDF contains no extractable text', 'EMPTY_TEXT');
    }

    const duration = Date.now() - startTime;
    console.log(`[parsePDF] PDF parsing complete in ${duration}ms, pages: ${parsedPages.length}`);

    return {
      type: 'pdf',
      pages: parsedPages,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[parsePDF] Error after ${duration}ms:`, error);
    
    if (error instanceof PDFParseError) {
      throw error;
    }
    
    if (error instanceof Error) {
      console.error('[parsePDF] Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack?.substring(0, 500),
      });
      
      if (error.message.includes('encrypted') || error.message.includes('password') || error.message.includes('Encrypted')) {
        throw new PDFParseError('PDF is encrypted and cannot be parsed', 'ENCRYPTED_PDF');
      }
      if (error.message.includes('Invalid PDF') || error.message.includes('corrupt') || error.message.includes('Invalid') || error.message.includes('parse')) {
        throw new PDFParseError('Invalid or corrupted PDF file', 'INVALID_PDF');
      }
    }
    
    throw new PDFParseError('Failed to parse PDF: ' + (error instanceof Error ? error.message : 'Unknown error'), 'INVALID_PDF');
  }
}