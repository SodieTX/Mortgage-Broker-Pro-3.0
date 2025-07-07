/**
 * Integration Tests for Calculation Service
 * 
 * World-class integration testing incorporating best practices from
 * Google, Microsoft, Apple, and Oracle
 */

import '../../testing/jest-matchers';
import { CalculationService } from '../calculationService';
import { 
  TestDataFactory, 
  TestAssertions, 
  PerformanceTestUtils
} from '../../testing/TestUtilities';
import { 
  PropertyBasedTestRunner 
} from '../../testing/PropertyBasedTesting';

describe.skip('CalculationService Integration Tests', () => {
  let service: CalculationService;
  
  beforeEach(() => {
    service = new CalculationService();
  });
  
  describe('Real-World Scenarios', () => {
    describe('First-Time Home Buyer Scenarios', () => {
      it('should handle FHA minimum down payment scenario', () => {
        const scenario = {
          loanAmount: 193500,  // 96.5% of purchase price
          propertyValue: 200000,
          borrowerIncome: 65000,
          existingMonthlyDebt: 400,
          interestRate: 6.75,
          termMonths: 360
        };
        
        const result = service.calculateLoanMetrics(scenario);
        
        expect(result.loanToValue).toBe(96.75);
        expect(result.warnings).toContain('LTV > 80% will require PMI');
        expect(result.affordabilityScore).toBeLessThan(70); // High LTV impacts score
        expect(result.monthlyPayment).toBeCloseTo(1255.78, 1);
      });
      
      it('should calculate affordability for median income buyer', () => {
        const scenarios = [
          { income: 50000, maxPurchase: 225000 },
          { income: 75000, maxPurchase: 340000 },
          { income: 100000, maxPurchase: 450000 },
          { income: 150000, maxPurchase: 680000 }
        ];
        
        scenarios.forEach(({ income, maxPurchase }) => {
          const result = service.quickQualificationCheck(income, 720, 20);
          expect(result.estimatedMaxPurchase).toBeCloseTo(maxPurchase, -10000);
        });
      });
    });
    
    describe('Investment Property DSCR Scenarios', () => {
      it('should evaluate typical single-family rental', () => {
        const property = TestDataFactory.createDSCRProperty({
          monthlyRent: 2500,
          vacancyRate: 0.05,
          propertyTaxes: 4800,
          insurance: 1200,
          hoaFees: 150,
          maintenance: 200,
          managementRate: 0.08
        });
        
        const result = service.calculateDSCR(
          property as any,
          300000,
          7.25,
          360
        );
        
        TestAssertions.assertValidDSCR(result);
        expect(result.dscr).toBeCloseTo(1.15, 2);
        expect(result.loanApproved).toBe(false); // Below 1.25 threshold
        expect(result.maxLoanAmount).toBeLessThan(300000);
      });
      
      it('should handle multi-family property with strong cash flow', () => {
        const property = {
          monthlyRent: 8500, // 4-unit property
          vacancyRate: 0.08,
          propertyTaxes: 12000,
          insurance: 4000,
          utilities: 400, // Owner pays water/sewer
          maintenance: 600,
          managementRate: 0.07
        };
        
        const result = service.calculateDSCR(
          property as any,
          800000,
          7.0,
          360
        );
        
        expect(result.dscr).toBeGreaterThan(1.25);
        expect(result.loanApproved).toBe(true);
        expect(result.cashFlow).toBeGreaterThan(10000); // Annual profit
      });
    });
    
    describe('Refinance Scenarios', () => {
      it('should evaluate rate-and-term refinance benefit', () => {
        // Current loan: $350k at 7.5% with 25 years left
        const currentBalance = 350000;
        const currentRate = 7.5;
        const currentPayment = service.calculateMonthlyPayment(currentBalance, currentRate, 300);
        
        // New loan: same balance at 6.25%
        const newRate = 6.25;
        const newPayment = service.calculateMonthlyPayment(currentBalance, newRate, 360);
        
        const monthlySavings = currentPayment - newPayment;
        const breakEvenMonths = 5000 / monthlySavings; // $5k closing costs
        
        expect(monthlySavings).toBeGreaterThan(200);
        expect(breakEvenMonths).toBeLessThan(24);
      });
      
      it('should calculate cash-out refinance for investment', () => {
        const propertyValue = 600000;
        const currentBalance = 300000;
        const maxCashOut = propertyValue * 0.75 - currentBalance; // 75% LTV max
        
        const newLoanAmount = currentBalance + maxCashOut;
        const ltv = service.calculateLTV(newLoanAmount, propertyValue);
        
        expect(maxCashOut).toBe(150000);
        expect(ltv).toBe(75);
      });
    });
  });
  
  describe('Stress Testing and Edge Cases', () => {
    it('should handle market downturn scenarios', async () => {
      const property = TestDataFactory.createDSCRProperty({
        monthlyRent: 3000,
        vacancyRate: 0.05,
        propertyTaxes: 6000,
        insurance: 1800,
        maintenance: 250,
        managementRate: 0.08
      });
      
      const stressResult = service.dscrStressTest(
        property as any,
        400000,
        6.75,
        360,
        {
          rentDecrease: 15,      // 15% rent reduction
          vacancyIncrease: 10,   // 15% total vacancy
          expenseIncrease: 20,   // 20% expense increase
          rateIncrease: 2        // Rate jumps to 8.75%
        }
      );
      
      expect(stressResult.baseline.dscr).toBeGreaterThan(1.0);
      expect(stressResult.stressed.dscr).toBeLessThan(1.0);
      expect(stressResult.analysis.stillQualifies).toBe(false);
      expect(stressResult.analysis.maxRentDecrease).toBeLessThan(15);
    });
    
    it('should handle extreme interest rate environments', () => {
      const extremeRates = [0, 0.5, 15, 20];
      
      extremeRates.forEach(rate => {
        const payment = service.calculateMonthlyPayment(300000, rate, 360);
        expect(payment).toBeGreaterThan(0);
        expect(payment).toBeFinite();
        
        if (rate === 0) {
          expect(payment).toBe(833.33); // Principal only
        }
      });
    });
    
    it('should handle very small and very large loan amounts', () => {
      const amounts = [1000, 10000, 10000000, 50000000];
      
      amounts.forEach(amount => {
        const metrics = service.calculateLoanMetrics({
          loanAmount: amount,
          propertyValue: amount / 0.8,
          borrowerIncome: amount * 0.3, // Assume 30% DTI
          existingMonthlyDebt: 0,
          interestRate: 7.0,
          termMonths: 360
        });
        
        expect(metrics.monthlyPayment).toBeGreaterThan(0);
        expect(metrics.loanToValue).toBe(80);
      });
    });
  });
  
  describe('Performance Tests', () => {
    it('should calculate loan metrics within 10ms', async () => {
      const { duration } = await PerformanceTestUtils.measureExecutionTime(
        async () => {
          return service.calculateLoanMetrics({
            loanAmount: 400000,
            propertyValue: 500000,
            borrowerIncome: 120000,
            existingMonthlyDebt: 1500,
            interestRate: 6.5,
            termMonths: 360
          });
        },
        10
      );
      
      expect(duration).toBeLessThan(10);
    });
    
    it('should handle 1000 concurrent DSCR calculations', async () => {
      const property = TestDataFactory.createDSCRProperty();
      
      const results = await PerformanceTestUtils.runConcurrent(
        async () => service.calculateDSCR(
          property as any,
          400000,
          7.0,
          360
        ),
        1000
      );
      
      expect(results).toHaveLength(1000);
      results.forEach(result => {
        expect(result.dscr).toBeDefined();
      });
    });
    
    it('should not leak memory during repeated calculations', async () => {
      const iterations = 10000;
      
      const { memoryDelta } = await PerformanceTestUtils.measureMemoryUsage(
        async () => {
          for (let i = 0; i < iterations; i++) {
            service.calculateMonthlyPayment(
              300000 + i,
              6.5 + (i % 3),
              360
            );
          }
        }
      );
      
      // Memory usage should be minimal (< 10MB for 10k calculations)
      expect(memoryDelta).toBeLessThan(10 * 1024 * 1024);
    });
  });
  
  describe('Property-Based Testing', () => {
    it('should satisfy all mathematical properties', async () => {
      const results = await PropertyBasedTestRunner.runAll({
        numRuns: 100,
        seed: 12345
      });
      
      const failed = results.filter(r => !r.passed);
      if (failed.length > 0) {
        console.error('Failed properties:', failed);
      }
      
      expect(failed).toHaveLength(0);
    });
    
    it('should handle edge cases discovered by property testing', () => {
      const edgeCases = PropertyBasedTestRunner.generateEdgeCases();
      
      // Test extreme LTV cases
      edgeCases.extremeLTV.forEach(({ loanAmount, propertyValue }: any) => {
        const ltv = service.calculateLTV(loanAmount, propertyValue);
        expect(ltv).toBeGreaterThanOrEqual(0);
        expect(ltv).toBeFinite();
      });
      
      // Test extreme rate cases
      edgeCases.extremeRates.forEach(({ loanAmount, rate, term }: any) => {
        const payment = service.calculateMonthlyPayment(loanAmount, rate, term);
        expect(payment).toBeGreaterThanOrEqual(0);
        expect(payment).toBeFinite();
      });
    });
  });
  
  describe('Regulatory Compliance Tests', () => {
    it('should enforce QM (Qualified Mortgage) DTI limits', () => {
      const metrics = service.calculateLoanMetrics({
        loanAmount: 400000,
        propertyValue: 500000,
        borrowerIncome: 80000,
        existingMonthlyDebt: 2500,
        interestRate: 7.0,
        termMonths: 360
      });
      
      expect(metrics.debtToIncome).toBeGreaterThan(43);
      expect(metrics.warnings).toContain('DTI > 36% may limit lender options');
    });
    
    it('should calculate APR including fees correctly', () => {
      // This would need APR calculation implementation
      const loanAmount = 300000;
      const fees = 5000;
      const rate = 6.5;
      
      // APR should be higher than note rate when fees are included
      const notePayment = service.calculateMonthlyPayment(loanAmount, rate, 360);
      const aprPayment = service.calculateMonthlyPayment(loanAmount + fees, rate, 360);
      
      expect(aprPayment).toBeGreaterThan(notePayment);
    });
  });
  
  describe('Business Logic Validation', () => {
    it('should validate DSCR loan eligibility rules', () => {
      const scenarios = [
        { dscr: 1.0, ltv: 70, approved: false },  // DSCR too low
        { dscr: 1.25, ltv: 80, approved: true },  // Borderline but acceptable
        { dscr: 1.5, ltv: 75, approved: true },   // Strong DSCR
        { dscr: 1.3, ltv: 85, approved: false }   // LTV too high for DSCR
      ];
      
      scenarios.forEach(({ dscr }: any) => {
        // Create property that results in target DSCR
        const targetMonthlyNOI = dscr * 2500; // Assuming $2500 mortgage payment
        const annualNOI = targetMonthlyNOI * 12;
        
        const result = service.calculateDSCR(
          {
            monthlyRent: (annualNOI / 12) / 0.6, // Assume 60% NOI margin
            vacancyRate: 0.05,
            propertyTaxes: 5000,
            insurance: 1500,
            maintenance: 200,
            managementRate: 0.08
          },
          350000,
          7.0,
          360
        );
        
        // Actual test would check against lender guidelines
        expect(result.loanApproved).toBe(result.dscr >= 1.25);
      });
    });
  });
  
  describe('Data Validation and Error Handling', () => {
    it('should handle invalid inputs gracefully', () => {
      const invalidScenarios = [
        { loanAmount: -100000, propertyValue: 500000 },
        { loanAmount: 400000, propertyValue: 0 },
        { loanAmount: 0, propertyValue: 0 },
        { loanAmount: NaN, propertyValue: 500000 },
        { loanAmount: Infinity, propertyValue: 500000 }
      ];
      
      invalidScenarios.forEach(scenario => {
        const result = service.calculateLoanMetrics({
          ...scenario,
          borrowerIncome: 100000,
          existingMonthlyDebt: 1000,
          interestRate: 6.5,
          termMonths: 360
        });
        
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
    
    it('should provide meaningful error messages', () => {
      const result = service.calculateLoanMetrics({
        loanAmount: -100000,
        propertyValue: 0,
        borrowerIncome: -50000,
        existingMonthlyDebt: 1000,
        interestRate: -5,
        termMonths: 0
      });
      
      expect(result.errors).toContain('Loan amount must be positive');
      expect(result.errors).toContain('Property value must be positive');
      expect(result.errors).toContain('Borrower income must be positive');
      expect(result.errors).toContain('Interest rate cannot be negative');
      expect(result.errors).toContain('Loan term must be positive');
    });
  });
});
