// Import DOMMatrix polyfill first to ensure it's available before pdfjs-dist
import '@/lib/ingestion/dom-matrix-polyfill';

import { parseCSV, CSVParseError } from '@/lib/ingestion/csv';
import { parsePDF, PDFParseError } from '@/lib/ingestion/pdf';

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_CSV_ROWS = 2000;
export const MAX_PDF_PAGES = 30;
export const ALLOWED_TYPES = ['application/pdf', 'text/csv', 'application/vnd.ms-excel', 'text/plain'] as const;

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates that the file size is within the maximum allowed limit (10MB).
 * 
 * @param file - File to validate
 * @returns Validation result with valid flag and optional error message
 */
export async function validateFileSize(file: globalThis.File): Promise<ValidationResult> {
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
    };
  }
  return { valid: true };
}

/**
 * Validates that the file type is supported (PDF or CSV).
 * Accepts: application/pdf, text/csv, application/vnd.ms-excel, text/plain
 * 
 * @param file - File to validate
 * @returns Validation result with valid flag and optional error message
 */
export function validateFileType(file: globalThis.File): ValidationResult {
  if (!ALLOWED_TYPES.includes(file.type as typeof ALLOWED_TYPES[number])) {
    return {
      valid: false,
      error: 'Invalid file type. Only PDF and CSV files are supported.',
    };
  }
  return { valid: true };
}

/**
 * Validates CSV files by parsing and checking row count limit (2,000 rows).
 * Skips validation for non-CSV files.
 * 
 * @param file - File to validate (must be CSV type)
 * @returns Validation result with valid flag and optional error message
 */
export async function validateCSVRows(file: globalThis.File): Promise<ValidationResult> {
  if (!file.type.includes('csv')) {
    return { valid: true };
  }

  try {
    const text = await file.text();
    const parsed = parseCSV(text);
    
    if (parsed.rows.length > MAX_CSV_ROWS) {
      return {
        valid: false,
        error: `Document too large for synchronous processing: ${parsed.rows.length} rows (max ${MAX_CSV_ROWS})`,
      };
    }
    
    return { valid: true };
  } catch (error) {
    if (error instanceof CSVParseError) {
      return {
        valid: false,
        error: error.message,
      };
    }
    if (error instanceof Error) {
      return {
        valid: false,
        error: `Failed to validate CSV file: ${error.message}`,
      };
    }
    return {
      valid: false,
      error: 'Failed to validate CSV file',
    };
  }
}

/**
 * Validates PDF files by parsing and checking page count limit (30 pages).
 * Skips validation for non-PDF files.
 * 
 * @param file - File to validate (must be PDF type)
 * @returns Validation result with valid flag and optional error message
 */
export async function validatePDFPages(file: globalThis.File): Promise<ValidationResult> {
  if (!file.type.includes('pdf')) {
    return { valid: true };
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const parsed = await parsePDF(buffer);
    
    if (parsed.pages.length > MAX_PDF_PAGES) {
      return {
        valid: false,
        error: `Document too large for synchronous processing: ${parsed.pages.length} pages (max ${MAX_PDF_PAGES})`,
      };
    }
    
    return { valid: true };
  } catch (error) {
    if (error instanceof PDFParseError) {
      return {
        valid: false,
        error: error.message,
      };
    }
    if (error instanceof Error) {
      return {
        valid: false,
        error: `Failed to validate PDF file: ${error.message}`,
      };
    }
    return {
      valid: false,
      error: 'Failed to validate PDF file',
    };
  }
}

/**
 * Comprehensive document validation: checks file size, type, CSV row limits, and PDF page limits.
 * Runs all validation checks in sequence and returns first failure or success.
 * 
 * @param file - File to validate
 * @returns Validation result with valid flag and optional error message
 */
export async function validateDocument(file: globalThis.File): Promise<ValidationResult> {
  const sizeCheck = await validateFileSize(file);
  if (!sizeCheck.valid) {
    return sizeCheck;
  }

  const typeCheck = validateFileType(file);
  if (!typeCheck.valid) {
    return typeCheck;
  }

  const csvCheck = await validateCSVRows(file);
  if (!csvCheck.valid) {
    return csvCheck;
  }

  const pdfCheck = await validatePDFPages(file);
  if (!pdfCheck.valid) {
    return pdfCheck;
  }

  return { valid: true };
}

