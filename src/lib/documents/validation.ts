import { parseCSV, CSVParseError } from '@/lib/ingestion/csv';

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_CSV_ROWS = 10000;
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
 * Validates CSV files by parsing and checking row count limit (10,000 rows).
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
    parseCSV(text);
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
 * Comprehensive document validation: checks file size, type, and CSV row limits.
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

  return { valid: true };
}

