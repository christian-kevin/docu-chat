import {
  validateFileSize,
  validateFileType,
  validateCSVRows,
  validateDocument,
  MAX_FILE_SIZE,
  MAX_CSV_ROWS,
} from '../validation';

describe('document-validation', () => {
  describe('validateFileSize', () => {
    it('should accept files under the size limit', async () => {
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      Object.defineProperty(file, 'size', { value: MAX_FILE_SIZE - 1, writable: false });

      const result = await validateFileSize(file);
      expect(result.valid).toBe(true);
    });

    it('should reject files exceeding the size limit', async () => {
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      Object.defineProperty(file, 'size', { value: MAX_FILE_SIZE + 1, writable: false });

      const result = await validateFileSize(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too large');
    });

    it('should accept files at exactly the size limit', async () => {
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      Object.defineProperty(file, 'size', { value: MAX_FILE_SIZE, writable: false });

      const result = await validateFileSize(file);
      expect(result.valid).toBe(true);
    });
  });

  describe('validateFileType', () => {
    it('should accept PDF files', () => {
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      const result = validateFileType(file);
      expect(result.valid).toBe(true);
    });

    it('should accept CSV files', () => {
      const file = new File(['test'], 'test.csv', { type: 'text/csv' });
      const result = validateFileType(file);
      expect(result.valid).toBe(true);
    });

    it('should accept Excel CSV files', () => {
      const file = new File(['test'], 'test.csv', { type: 'application/vnd.ms-excel' });
      const result = validateFileType(file);
      expect(result.valid).toBe(true);
    });

    it('should accept plain text CSV files', () => {
      const file = new File(['test'], 'test.csv', { type: 'text/plain' });
      const result = validateFileType(file);
      expect(result.valid).toBe(true);
    });

    it('should reject unsupported file types', () => {
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      Object.defineProperty(file, 'type', { value: 'image/png', writable: false });
      const result = validateFileType(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid file type');
    });
  });

  describe('validateCSVRows', () => {
    it('should skip validation for non-CSV files', async () => {
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      const result = await validateCSVRows(file);
      expect(result.valid).toBe(true);
    });

    it('should accept valid CSV files', async () => {
      const csvContent = 'name,value\ntest,123\n';
      const file = new File([csvContent], 'test.csv', { type: 'text/csv' });
      const result = await validateCSVRows(file);
      expect(result.valid).toBe(true);
    });

    it('should reject CSV files exceeding row limit', async () => {
      const header = 'col1,col2\n';
      const rows = Array.from({ length: MAX_CSV_ROWS + 1 }, () => 'val1,val2').join('\n');
      const csvContent = header + rows;
      const file = new File([csvContent], 'test.csv', { type: 'text/csv' });

      const result = await validateCSVRows(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum row limit');
    });

    it('should reject empty CSV files', async () => {
      const file = new File([''], 'test.csv', { type: 'text/csv' });
      const result = await validateCSVRows(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should accept CSV files at exactly the row limit', async () => {
      const header = 'col1,col2\n';
      const rows = Array.from({ length: MAX_CSV_ROWS }, () => 'val1,val2').join('\n');
      const csvContent = header + rows;
      const file = new File([csvContent], 'test.csv', { type: 'text/csv' });

      const result = await validateCSVRows(file);
      expect(result.valid).toBe(true);
    });
  });

  describe('validateDocument', () => {
    it('should accept valid PDF files', async () => {
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      Object.defineProperty(file, 'size', { value: MAX_FILE_SIZE - 1, writable: false });

      const result = await validateDocument(file);
      expect(result.valid).toBe(true);
    });

    it('should accept valid CSV files', async () => {
      const csvContent = 'name,value\ntest,123';
      const file = new File([csvContent], 'test.csv', { type: 'text/csv' });
      Object.defineProperty(file, 'size', { value: MAX_FILE_SIZE - 1, writable: false });

      const result = await validateDocument(file);
      expect(result.valid).toBe(true);
    });

    it('should reject files that are too large', async () => {
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      Object.defineProperty(file, 'size', { value: MAX_FILE_SIZE + 1, writable: false });

      const result = await validateDocument(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too large');
    });

    it('should reject files with invalid types', async () => {
      const file = new File(['test'], 'test.png', { type: 'image/png' });
      Object.defineProperty(file, 'size', { value: MAX_FILE_SIZE - 1, writable: false });

      const result = await validateDocument(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid file type');
    });

    it('should reject CSV files exceeding row limit', async () => {
      const header = 'col1,col2\n';
      const rows = Array.from({ length: MAX_CSV_ROWS + 1 }, () => 'val1,val2').join('\n');
      const csvContent = header + rows;
      const file = new File([csvContent], 'test.csv', { type: 'text/csv' });
      Object.defineProperty(file, 'size', { value: MAX_FILE_SIZE - 1, writable: false });

      const result = await validateDocument(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum row limit');
    });
  });
});

