/**
 * CSV Transformer
 * 
 * Simple CSV to loan data transformation
 */

import { parse } from 'csv-parse';
import { Readable } from 'stream';

export interface TransformResult {
  success: boolean;
  data?: any;
  errors?: string[];
}

/**
 * Transform CSV data to our loan data format
 */
export async function transformCSV(csvContent: string | Buffer): Promise<TransformResult> {
  const errors: string[] = [];
  const records: any[] = [];
  
  return new Promise((resolve) => {
    const parser = parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
      cast: true,
      cast_date: false
    });
    
    parser.on('readable', function() {
      let record;
      while ((record = parser.read()) !== null) {
        // Transform the record to our format
        const transformed = transformRecord(record);
        if (transformed.errors.length > 0) {
          errors.push(...transformed.errors);
        } else {
          records.push(transformed.data);
        }
      }
    });
    
    parser.on('error', (err) => {
      errors.push(`Parse error: ${err.message}`);
    });
    
    parser.on('end', () => {
      if (errors.length > 0) {
        resolve({ success: false, errors });
      } else {
        resolve({ success: true, data: records });
      }
    });
    
    // Create a readable stream from the content
    const stream = Readable.from(csvContent.toString());
    stream.pipe(parser);
  });
}

/**
 * Transform a single CSV record to loan data format
 */
function transformRecord(record: any): { data?: any; errors: string[] } {
  const errors: string[] = [];
  
  try {
    // Map CSV fields to our loan data structure
    const loanData = {
      borrower: {
        firstName: record['First Name'] || record['first_name'] || record['firstname'],
        lastName: record['Last Name'] || record['last_name'] || record['lastname'],
        email: record['Email'] || record['email'],
        phone: record['Phone'] || record['phone'],
        creditScore: parseNumber(record['Credit Score'] || record['credit_score']),
        annualIncome: parseNumber(record['Annual Income'] || record['annual_income'] || record['income'])
      },
      property: {
        address: record['Property Address'] || record['address'],
        city: record['City'] || record['city'],
        state: record['State'] || record['state'],
        zipCode: record['ZIP'] || record['Zip Code'] || record['zip_code'],
        propertyType: record['Property Type'] || record['property_type'],
        purchasePrice: parseNumber(record['Purchase Price'] || record['purchase_price']),
        estimatedValue: parseNumber(record['Estimated Value'] || record['estimated_value'])
      },
      loan: {
        loanAmount: parseNumber(record['Loan Amount'] || record['loan_amount']),
        loanPurpose: record['Loan Purpose'] || record['loan_purpose'],
        loanType: record['Loan Type'] || record['loan_type'],
        termMonths: parseNumber(record['Term'] || record['term_months'])
      }
    };
    
    // Create a title from available data
    const title = record['Title'] || 
                  record['Scenario Name'] || 
                  `${loanData.borrower.firstName} ${loanData.borrower.lastName} - ${loanData.property.city || 'Unknown'}`;
    
    return {
      data: {
        title: title.trim(),
        description: record['Description'] || record['Notes'] || null,
        loanData
      },
      errors: []
    };
  } catch (error) {
    errors.push(`Failed to transform record: ${error}`);
    return { errors };
  }
}

/**
 * Helper to parse numbers safely
 */
function parseNumber(value: any): number | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  
  // Remove common formatting
  const cleaned = value.toString()
    .replace(/[$,]/g, '')
    .replace(/[^0-9.-]/g, '');
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? undefined : num;
}
