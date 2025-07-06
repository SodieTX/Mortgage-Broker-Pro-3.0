/**
 * Validation Utilities
 * 
 * Simple, reusable validation functions
 */

import { LoanData } from '../types/scenario';

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Validate loan data
 */
export function validateLoanData(data: LoanData): ValidationResult {
  const errors: ValidationError[] = [];
  
  // Borrower validation
  if (data.borrower) {
    if (data.borrower.creditScore !== undefined) {
      if (data.borrower.creditScore < 300 || data.borrower.creditScore > 850) {
        errors.push({
          field: 'borrower.creditScore',
          message: 'Credit score must be between 300 and 850'
        });
      }
    }
    
    if (data.borrower.annualIncome !== undefined) {
      if (data.borrower.annualIncome < 0) {
        errors.push({
          field: 'borrower.annualIncome',
          message: 'Annual income must be positive'
        });
      }
    }
    
    if (data.borrower.email !== undefined && data.borrower.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.borrower.email)) {
        errors.push({
          field: 'borrower.email',
          message: 'Invalid email format'
        });
      }
    }
  }
  
  // Property validation
  if (data.property) {
    if (data.property.purchasePrice !== undefined) {
      if (data.property.purchasePrice <= 0) {
        errors.push({
          field: 'property.purchasePrice',
          message: 'Purchase price must be positive'
        });
      }
    }
    
    if (data.property.zipCode !== undefined && data.property.zipCode) {
      const zipRegex = /^\d{5}(-\d{4})?$/;
      if (!zipRegex.test(data.property.zipCode)) {
        errors.push({
          field: 'property.zipCode',
          message: 'Invalid ZIP code format'
        });
      }
    }
  }
  
  // Loan validation
  if (data.loan) {
    if (data.loan.loanAmount !== undefined) {
      if (data.loan.loanAmount <= 0) {
        errors.push({
          field: 'loan.loanAmount',
          message: 'Loan amount must be positive'
        });
      }
    }
    
    if (data.loan.termMonths !== undefined) {
      const validTerms = [120, 180, 240, 360]; // 10, 15, 20, 30 years
      if (!validTerms.includes(data.loan.termMonths)) {
        errors.push({
          field: 'loan.termMonths',
          message: 'Loan term must be 120, 180, 240, or 360 months'
        });
      }
    }
    
    // LTV validation if we have both values
    if (data.loan.loanAmount && data.property?.purchasePrice) {
      const ltv = (data.loan.loanAmount / data.property.purchasePrice) * 100;
      if (ltv > 97) {
        errors.push({
          field: 'loan.loanAmount',
          message: `Loan-to-value ratio (${ltv.toFixed(1)}%) exceeds 97%`
        });
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate required fields for scenario creation
 */
export function validateScenarioCreate(title: string): ValidationResult {
  const errors: ValidationError[] = [];
  
  if (!title || title.trim().length === 0) {
    errors.push({
      field: 'title',
      message: 'Title is required'
    });
  } else if (title.trim().length < 3) {
    errors.push({
      field: 'title',
      message: 'Title must be at least 3 characters'
    });
  } else if (title.length > 200) {
    errors.push({
      field: 'title',
      message: 'Title must not exceed 200 characters'
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}
