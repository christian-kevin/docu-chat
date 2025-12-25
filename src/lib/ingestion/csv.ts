import { parse } from 'csv-parse/sync';
import { MAX_CSV_ROWS } from '@/lib/documents/validation';

export interface ParsedCSVRow {
  rowIndex: number;
  serializedText: string;
}

export interface ParsedCSV {
  type: 'csv';
  rows: ParsedCSVRow[];
}

export class CSVParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CSVParseError';
  }
}

export function parseCSV(csvText: string, entityName: string = 'record'): ParsedCSV {
  try {
    const records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    }) as Record<string, string>[];

    if (!records || records.length === 0) {
      throw new CSVParseError('CSV file is empty or has no data rows');
    }

    const headers = Object.keys(records[0]);
    
    if (headers.length === 0) {
      throw new CSVParseError('CSV file has no headers');
    }

    if (records.length > MAX_CSV_ROWS) {
      throw new CSVParseError(
        `CSV file exceeds maximum row limit of ${MAX_CSV_ROWS}. Found ${records.length} rows.`
      );
    }

    const serializedRows: ParsedCSVRow[] = records.map((record, index) => {
      const recordValues = Object.values(record).filter(v => v !== undefined && v !== '');
      const headerCount = headers.length;
      const valueCount = recordValues.length;
      
      if (valueCount !== headerCount) {
        console.warn(
          `CSV row ${index + 1}: Expected ${headerCount} columns, found ${valueCount} values. ` +
          `Missing or extra cells detected. Continuing ingestion.`
        );
      }

      const serializedText = serializeCSVRow(record, headers, entityName);
      return {
        rowIndex: index + 1,
        serializedText,
      };
    });

    return {
      type: 'csv',
      rows: serializedRows,
    };

  } catch (error) {
    if (error instanceof CSVParseError) {
      throw error;
    }
    
    if (error instanceof Error) {
      if (error.message.includes('Invalid') || error.message.includes('parse')) {
        throw new CSVParseError('Invalid CSV format: ' + error.message);
      }
    }
    
    throw new CSVParseError('Failed to parse CSV: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

function normalizeEntity(entity: string): string {
  return entity
    .trim()
    .replace(/[_-]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase();
}

function normalizeHeader(header: string): string {
  return header
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
}

function serializeCSVRow(
  record: Record<string, string>,
  headers: string[],
  entityName: string
): string {
  const parts: string[] = [];
  const entity = normalizeEntity(entityName);

  parts.push(`This record describes a ${entity}.`);

  for (const header of headers) {
    const value = record[header];
    if (value === undefined || value === '') continue;

    const readableHeader = normalizeHeader(header);
    parts.push(`${readableHeader}: ${value}.`);
  }

  return parts.join(' ');
}