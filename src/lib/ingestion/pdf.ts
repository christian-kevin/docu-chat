// Import polyfill first to ensure DOMMatrix is available before pdfjs-dist
import './dom-matrix-polyfill';

import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

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
  // Ensure DOMMatrix is available (defensive check for serverless environments)
  // This is a fallback in case the polyfill import didn't work
  if (typeof window === 'undefined' && typeof globalThis.DOMMatrix === 'undefined') {
    globalThis.DOMMatrix = class DOMMatrix {
      constructor() {
      }
      static fromMatrix() {
        return new DOMMatrix();
      }
    } as any;
    if (typeof global !== 'undefined') {
      global.DOMMatrix = globalThis.DOMMatrix;
    }
    if (typeof self !== 'undefined') {
      self.DOMMatrix = globalThis.DOMMatrix;
    }
  }

  try {
    const buffer = pdfBuffer instanceof ArrayBuffer ? Buffer.from(pdfBuffer) : pdfBuffer;
    const uint8Array = new Uint8Array(buffer);

    const loadingTask = getDocument({ data: uint8Array });
    
    loadingTask.onPassword = () => {
      throw new PDFParseError('PDF is encrypted and cannot be parsed', 'ENCRYPTED_PDF');
    };
    
    const pdf = await loadingTask.promise;

    const pages: ParsedPDFPage[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      const pageText = textContent.items
        .map((item: any) => ('str' in item ? item.str : ''))
        .filter(Boolean)
        .join(' ');

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
      // Handle DOMMatrix errors specifically
      if (error.message.includes('DOMMatrix') || error.name === 'ReferenceError' && error.message.includes('DOMMatrix')) {
        throw new PDFParseError('PDF parsing failed: DOMMatrix polyfill not available in serverless environment', 'INVALID_PDF');
      }
      if (error.message.includes('worker') || error.message.includes('WorkerMessageHandler') || error.message.includes('GlobalWorkerOptions')) {
        throw new PDFParseError('PDF parsing failed: Worker initialization error in serverless environment', 'INVALID_PDF');
      }
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