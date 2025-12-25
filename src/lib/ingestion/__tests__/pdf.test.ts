import { parsePDF, PDFParseError } from '../pdf';
import { readFileSync } from 'fs';
import { join } from 'path';

// Increase timeout for PDF parsing tests
jest.setTimeout(30000);

describe('parsePDF', () => {
  const samplePdfPath = join(process.cwd(), 'tests', 'fixtures', 'sample.pdf');

  it('should parse a valid PDF file', async () => {
    const pdfBuffer = readFileSync(samplePdfPath);
    const result = await parsePDF(pdfBuffer);

    expect(result.type).toBe('pdf');
    expect(result.pages).toBeDefined();
    expect(result.pages.length).toBeGreaterThan(0);
    expect(result.pages[0].pageNumber).toBe(1);
    expect(result.pages[0].text).toBeDefined();
    expect(result.pages[0].text.length).toBeGreaterThan(0);
  }, 30000);

  it('should normalize whitespace while preserving paragraph boundaries', async () => {
    const pdfBuffer = readFileSync(samplePdfPath);
    const result = await parsePDF(pdfBuffer);

    const text = result.pages[0].text;
    expect(text).not.toMatch(/[ \t]{2,}/);
    expect(text).toContain('\n\n');
  }, 30000);

  it('should throw PDFParseError for invalid PDF', async () => {
    const invalidBuffer = Buffer.from('This is not a PDF file');

    await expect(parsePDF(invalidBuffer)).rejects.toThrow(PDFParseError);
    await expect(parsePDF(invalidBuffer)).rejects.toThrow('INVALID_PDF');
  }, 30000);

  it('should throw PDFParseError for empty text', async () => {
    const emptyPdf = Buffer.from('%PDF-1.4\n%%EOF');
    
    await expect(parsePDF(emptyPdf)).rejects.toThrow(PDFParseError);
    await expect(parsePDF(emptyPdf)).rejects.toThrow('EMPTY_TEXT');
  }, 30000);

  it('should handle ArrayBuffer input', async () => {
    const pdfBuffer = readFileSync(samplePdfPath);
    const arrayBuffer = pdfBuffer.buffer.slice(
      pdfBuffer.byteOffset,
      pdfBuffer.byteOffset + pdfBuffer.byteLength
    );

    const result = await parsePDF(arrayBuffer);
    expect(result.type).toBe('pdf');
    expect(result.pages.length).toBeGreaterThan(0);
  }, 30000);

  it('should extract text per page with correct page numbers', async () => {
    const pdfBuffer = readFileSync(samplePdfPath);
    const result = await parsePDF(pdfBuffer);

    expect(result.pages.length).toBeGreaterThan(0);
    
    result.pages.forEach((page, index) => {
      expect(page.pageNumber).toBe(index + 1);
      expect(page.text).toBeDefined();
      expect(page.text.length).toBeGreaterThan(0);
    });
  }, 30000);
});
