if (typeof window === 'undefined') {
  if (typeof globalThis.DOMMatrix === 'undefined') {
    globalThis.DOMMatrix = class DOMMatrix {
      constructor(init?: string | number[]) {
        // Minimal polyfill for serverless
      }
      static fromMatrix() {
        return new DOMMatrix();
      }
    } as any;
  }
}

import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

if (typeof window === 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '';
}

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

    const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
    
    loadingTask.onPassword = () => {
      throw new PDFParseError('PDF is encrypted and cannot be parsed', 'ENCRYPTED_PDF');
    };
    
    const pdf = await loadingTask.promise;

    const numPages = pdf.numPages;
    const pages: ParsedPDFPage[] = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      const pageText = textContent.items
        .map((item) => ('str' in item ? item.str : ''))
        .filter(Boolean)
        .join('\n');

      if (pageText.trim()) {
        const normalizedText = normalizeWhitespace(pageText);
        pages.push({
          pageNumber: pageNum,
          text: normalizedText,
        });
      }
    }

    if (pages.length === 0) {
      throw new PDFParseError('PDF contains no extractable text', 'EMPTY_TEXT');
    }

    return {
      type: 'pdf',
      pages,
    };

  } catch (error) {
    if (error instanceof PDFParseError) {
      throw error;
    }
    
    if (error instanceof Error) {
      if (error.message.includes('Invalid PDF') || error.message.includes('corrupt') || error.message.includes('Invalid')) {
        throw new PDFParseError('Invalid or corrupted PDF file', 'INVALID_PDF');
      }
      if (error.message.includes('encrypted') || error.message.includes('password') || error.message.includes('Encrypted')) {
        throw new PDFParseError('PDF is encrypted and cannot be parsed', 'ENCRYPTED_PDF');
      }
    }
    
    throw new PDFParseError('Failed to parse PDF: ' + (error instanceof Error ? error.message : 'Unknown error'), 'INVALID_PDF');
  }
}

function normalizeWhitespace(text: string): string {
  return text
    .split('\n\n')
    .map(p => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n');
}