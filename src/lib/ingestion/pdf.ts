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
  try {
    const buffer = pdfBuffer instanceof ArrayBuffer ? Buffer.from(pdfBuffer) : pdfBuffer;
    const uint8Array = new Uint8Array(buffer);
    
    const pdf = await getDocumentProxy(uint8Array);
    const { text } = await extractText(pdf, { mergePages: false });

    if (!text || text.length === 0) {
      throw new PDFParseError('PDF contains no extractable text', 'EMPTY_TEXT');
    }

    const parsedPages = text
      .map((pageText: string, i: number) => ({
        pageNumber: i + 1,
        text: pageText.replace(/\s+/g, ' ').trim(),
      }))
      .filter((page: { pageNumber: number; text: string }) => page.text.length > 0);

    if (parsedPages.length === 0) {
      throw new PDFParseError('PDF contains no extractable text', 'EMPTY_TEXT');
    }

    return {
      type: 'pdf',
      pages: parsedPages,
    };
  } catch (error) {
    if (error instanceof PDFParseError) {
      throw error;
    }
    
    if (error instanceof Error) {
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