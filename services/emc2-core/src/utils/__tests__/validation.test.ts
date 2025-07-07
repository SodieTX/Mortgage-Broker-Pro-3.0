/**
 * Comprehensive tests for validation utilities
 * This should provide ~95%+ coverage for validation.ts
 */

import { validateLoanData, validateScenarioCreate } from '../validation';
import { LoanData } from '../../types/scenario';

describe('validation utilities', () => {
  describe('validateLoanData', () => {
    it('should return valid for empty data', () => {
      const result = validateLoanData({});
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    describe('borrower validation', () => {
      it('should validate credit score range', () => {
        const data: LoanData = {
          borrower: { creditScore: 850 }
        };
        
        const result = validateLoanData(data);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject credit score below 300', () => {
        const data: LoanData = {
          borrower: { creditScore: 299 }
        };
        
        const result = validateLoanData(data);
        expect(result.isValid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toEqual({
          field: 'borrower.creditScore',
          message: 'Credit score must be between 300 and 850'
        });
      });

      it('should reject credit score above 850', () => {
        const data: LoanData = {
          borrower: { creditScore: 851 }
        };
        
        const result = validateLoanData(data);
        expect(result.isValid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toEqual({
          field: 'borrower.creditScore',
          message: 'Credit score must be between 300 and 850'
        });
      });

      it('should accept valid credit scores', () => {
        const testCases = [300, 500, 700, 850];
        
        testCases.forEach(score => {
          const data: LoanData = {
            borrower: { creditScore: score }
          };
          
          const result = validateLoanData(data);
          expect(result.isValid).toBe(true);
        });
      });

      it('should validate positive annual income', () => {
        const data: LoanData = {
          borrower: { annualIncome: 50000 }
        };
        
        const result = validateLoanData(data);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject negative annual income', () => {
        const data: LoanData = {
          borrower: { annualIncome: -1 }
        };
        
        const result = validateLoanData(data);
        expect(result.isValid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toEqual({
          field: 'borrower.annualIncome',
          message: 'Annual income must be positive'
        });
      });

      it('should validate email format', () => {
        const validEmails = [
          'test@example.com',
          'user.name@domain.co.uk',
          'first+last@gmail.com'
        ];
        
        validEmails.forEach(email => {
          const data: LoanData = {
            borrower: { email }
          };
          
          const result = validateLoanData(data);
          expect(result.isValid).toBe(true);
        });
      });

      it('should reject invalid email formats', () => {
        const invalidEmails = [
          'invalid-email',
          '@domain.com',
          'user@',
          'user@domain',
          'user.domain.com'
        ];
        
        invalidEmails.forEach(email => {
          const data: LoanData = {
            borrower: { email }
          };
          
          const result = validateLoanData(data);
          expect(result.isValid).toBe(false);
          expect(result.errors).toHaveLength(1);
          expect(result.errors[0]).toEqual({
            field: 'borrower.email',
            message: 'Invalid email format'
          });
        });
      });

      it('should handle empty email', () => {
        const data: LoanData = {
          borrower: { email: '' }
        };
        
        const result = validateLoanData(data);
        expect(result.isValid).toBe(true); // Empty email is allowed
      });

      it('should handle undefined email', () => {
        const data: LoanData = {
          borrower: { email: undefined }
        };
        
        const result = validateLoanData(data);
        expect(result.isValid).toBe(true);
      });
    });

    describe('property validation', () => {
      it('should validate positive purchase price', () => {
        const data: LoanData = {
          property: { purchasePrice: 300000 }
        };
        
        const result = validateLoanData(data);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject zero purchase price', () => {
        const data: LoanData = {
          property: { purchasePrice: 0 }
        };
        
        const result = validateLoanData(data);
        expect(result.isValid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toEqual({
          field: 'property.purchasePrice',
          message: 'Purchase price must be positive'
        });
      });

      it('should reject negative purchase price', () => {
        const data: LoanData = {
          property: { purchasePrice: -100 }
        };
        
        const result = validateLoanData(data);
        expect(result.isValid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toEqual({
          field: 'property.purchasePrice',
          message: 'Purchase price must be positive'
        });
      });

      it('should validate ZIP code formats', () => {
        const validZips = ['12345', '12345-6789'];
        
        validZips.forEach(zipCode => {
          const data: LoanData = {
            property: { zipCode }
          };
          
          const result = validateLoanData(data);
          expect(result.isValid).toBe(true);
        });
      });

      it('should reject invalid ZIP code formats', () => {
        const invalidZips = [
          '1234',      // Too short
          '123456',    // Too long
          '12345-123', // Invalid extended format
          'ABCDE',     // Letters
          '12345-ABCD' // Letters in extension
        ];
        
        invalidZips.forEach(zipCode => {
          const data: LoanData = {
            property: { zipCode }
          };
          
          const result = validateLoanData(data);
          expect(result.isValid).toBe(false);
          expect(result.errors).toHaveLength(1);
          expect(result.errors[0]).toEqual({
            field: 'property.zipCode',
            message: 'Invalid ZIP code format'
          });
        });
      });

      it('should handle empty ZIP code', () => {
        const data: LoanData = {
          property: { zipCode: '' }
        };
        
        const result = validateLoanData(data);
        expect(result.isValid).toBe(true); // Empty ZIP is allowed
      });
    });

    describe('loan validation', () => {
      it('should validate positive loan amount', () => {
        const data: LoanData = {
          loan: { loanAmount: 250000 }
        };
        
        const result = validateLoanData(data);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject zero loan amount', () => {
        const data: LoanData = {
          loan: { loanAmount: 0 }
        };
        
        const result = validateLoanData(data);
        expect(result.isValid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toEqual({
          field: 'loan.loanAmount',
          message: 'Loan amount must be positive'
        });
      });

      it('should reject negative loan amount', () => {
        const data: LoanData = {
          loan: { loanAmount: -100 }
        };
        
        const result = validateLoanData(data);
        expect(result.isValid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toEqual({
          field: 'loan.loanAmount',
          message: 'Loan amount must be positive'
        });
      });

      it('should validate loan terms', () => {
        const validTerms = [120, 180, 240, 360];
        
        validTerms.forEach(termMonths => {
          const data: LoanData = {
            loan: { termMonths }
          };
          
          const result = validateLoanData(data);
          expect(result.isValid).toBe(true);
        });
      });

      it('should reject invalid loan terms', () => {
        const invalidTerms = [60, 90, 300, 420];
        
        invalidTerms.forEach(termMonths => {
          const data: LoanData = {
            loan: { termMonths }
          };
          
          const result = validateLoanData(data);
          expect(result.isValid).toBe(false);
          expect(result.errors).toHaveLength(1);
          expect(result.errors[0]).toEqual({
            field: 'loan.termMonths',
            message: 'Loan term must be 120, 180, 240, or 360 months'
          });
        });
      });

      it('should validate LTV ratio', () => {
        const data: LoanData = {
          loan: { loanAmount: 290000 },
          property: { purchasePrice: 300000 }
        };
        
        const result = validateLoanData(data);
        expect(result.isValid).toBe(true); // 96.7% LTV is valid
      });

      it('should reject high LTV ratio', () => {
        const data: LoanData = {
          loan: { loanAmount: 292000 },
          property: { purchasePrice: 300000 }
        };
        
        const result = validateLoanData(data);
        expect(result.isValid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].field).toBe('loan.loanAmount');
        expect(result.errors[0].message).toContain('Loan-to-value ratio');
        expect(result.errors[0].message).toContain('exceeds 97%');
      });

      it('should not validate LTV when loan amount is missing', () => {
        const data: LoanData = {
          property: { purchasePrice: 300000 }
        };
        
        const result = validateLoanData(data);
        expect(result.isValid).toBe(true);
      });

      it('should not validate LTV when purchase price is missing', () => {
        const data: LoanData = {
          loan: { loanAmount: 250000 }
        };
        
        const result = validateLoanData(data);
        expect(result.isValid).toBe(true);
      });
    });

    describe('multiple errors', () => {
      it('should collect multiple validation errors', () => {
        const data: LoanData = {
          borrower: {
            creditScore: 200, // Invalid
            annualIncome: -1000, // Invalid
            email: 'invalid-email' // Invalid
          },
          property: {
            purchasePrice: -100, // Invalid
            zipCode: '123' // Invalid
          },
          loan: {
            loanAmount: -50000, // Invalid
            termMonths: 90 // Invalid
          }
        };
        
        const result = validateLoanData(data);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(5);
        
        // Check that errors from different sections are included
        const fields = result.errors.map(e => e.field);
        expect(fields).toContain('borrower.creditScore');
        expect(fields).toContain('borrower.annualIncome');
        expect(fields).toContain('borrower.email');
        expect(fields).toContain('property.purchasePrice');
        expect(fields).toContain('property.zipCode');
        expect(fields).toContain('loan.loanAmount');
        expect(fields).toContain('loan.termMonths');
      });
    });
  });

  describe('validateScenarioCreate', () => {
    it('should accept valid title', () => {
      const result = validateScenarioCreate('Valid Title');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty title', () => {
      const result = validateScenarioCreate('');
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        field: 'title',
        message: 'Title is required'
      });
    });

    it('should reject whitespace-only title', () => {
      const result = validateScenarioCreate('   ');
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        field: 'title',
        message: 'Title is required'
      });
    });

    it('should reject title shorter than 3 characters', () => {
      const result = validateScenarioCreate('AB');
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        field: 'title',
        message: 'Title must be at least 3 characters'
      });
    });

    it('should accept title with exactly 3 characters', () => {
      const result = validateScenarioCreate('ABC');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject title longer than 200 characters', () => {
      const longTitle = 'A'.repeat(201);
      const result = validateScenarioCreate(longTitle);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        field: 'title',
        message: 'Title must not exceed 200 characters'
      });
    });

    it('should accept title with exactly 200 characters', () => {
      const maxTitle = 'A'.repeat(200);
      const result = validateScenarioCreate(maxTitle);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should trim whitespace before validation', () => {
      const result = validateScenarioCreate('  Valid Title  ');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should trim and then validate length', () => {
      const result = validateScenarioCreate('  AB  '); // Trims to "AB"
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Title must be at least 3 characters');
    });
  });

  describe('edge cases', () => {
    it('should handle undefined borrower', () => {
      const data: LoanData = {
        borrower: undefined
      };
      
      const result = validateLoanData(data);
      expect(result.isValid).toBe(true);
    });

    it('should handle undefined property', () => {
      const data: LoanData = {
        property: undefined
      };
      
      const result = validateLoanData(data);
      expect(result.isValid).toBe(true);
    });

    it('should handle undefined loan', () => {
      const data: LoanData = {
        loan: undefined
      };
      
      const result = validateLoanData(data);
      expect(result.isValid).toBe(true);
    });

    it('should handle partial data objects', () => {
      const data: LoanData = {
        borrower: {},
        property: {},
        loan: {}
      };
      
      const result = validateLoanData(data);
      expect(result.isValid).toBe(true);
    });
  });
});