import { parseCSV, CSVParseError } from '../csv';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('parseCSV', () => {
  const sampleCsvPath = join(process.cwd(), 'tests', 'fixtures', 'sample.csv');

  it('should parse a valid CSV file with headers', () => {
    const csvText = readFileSync(sampleCsvPath, 'utf-8');
    const result = parseCSV(csvText, 'product');

    expect(result.type).toBe('csv');
    expect(result.rows).toBeDefined();
    expect(result.rows.length).toBe(3);
  });

  it('should serialize rows in semantic format', () => {
    const csvText = readFileSync(sampleCsvPath, 'utf-8');
    const result = parseCSV(csvText, 'product');

    const firstRow = result.rows[0];
    expect(firstRow.rowIndex).toBe(1);
    expect(firstRow.serializedText).toContain('This record describes a product');
    expect(firstRow.serializedText).toContain('Product Name: baba');
    expect(firstRow.serializedText).toContain('Price: 10000');
    expect(firstRow.serializedText).toContain('Category: food');
  });

  it('should skip empty cells', () => {
    const csvText = 'name,price,description\ntest,100,\n';
    const result = parseCSV(csvText);

    expect(result.rows.length).toBe(1);
    expect(result.rows[0].serializedText).toContain('Name: test');
    expect(result.rows[0].serializedText).toContain('Price: 100');
    expect(result.rows[0].serializedText).not.toContain('Description:');
  });

  it('should normalize headers (camelCase, snake_case, etc.)', () => {
    const csvText = 'product_name,unit_price,stockCount,PRODUCT_ID\nitem,10,5,123\n';
    const result = parseCSV(csvText);

    expect(result.rows[0].serializedText).toContain('Product Name:');
    expect(result.rows[0].serializedText).toContain('Unit Price:');
    expect(result.rows[0].serializedText).toContain('Stock Count:');
    expect(result.rows[0].serializedText).toContain('Product Id:');
  });

  it('should use custom entity name', () => {
    const csvText = 'name,value\ntest,123\n';
    const result = parseCSV(csvText, 'item');

    expect(result.rows[0].serializedText).toContain('This record describes a item');
  });

  it('should normalize entity name from filename patterns', () => {
    const csvText = 'name,value\ntest,123\n';
    const result1 = parseCSV(csvText, 'user_transactions');
    const result2 = parseCSV(csvText, 'ProductData');
    const result3 = parseCSV(csvText, 'customer-orders');

    expect(result1.rows[0].serializedText).toContain('This record describes a user transaction');
    expect(result2.rows[0].serializedText).toContain('This record describes a product data');
    expect(result3.rows[0].serializedText).toContain('This record describes a customer order');
  });

  it('should throw CSVParseError for empty CSV', () => {
    expect(() => parseCSV('')).toThrow(CSVParseError);
  });

  it('should throw CSVParseError for CSV without headers', () => {
    const csvText = 'value1,value2\n';
    expect(() => parseCSV(csvText)).toThrow(CSVParseError);
  });

  it('should trim header whitespace', () => {
    const csvText = ' name , price , category \nitem,10,food\n';
    const result = parseCSV(csvText);

    expect(result.rows[0].serializedText).toContain('Name:');
    expect(result.rows[0].serializedText).toContain('Price:');
    expect(result.rows[0].serializedText).toContain('Category:');
  });
});
