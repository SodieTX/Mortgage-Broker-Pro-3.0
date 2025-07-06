/**
 * Property-Based Testing Framework
 * 
 * Oracle-inspired approach to finding edge cases through
 * mathematical property verification
 */

import fc from 'fast-check';
import { CalculationService, PropertyFinancials } from '../services/calculationService';

/**
 * Property-based testing generators for mortgage calculations
 */
export class PropertyBasedGenerators {
  /**
   * Generate valid loan amounts
   */
  static loanAmount() {
    return fc.integer({ min: 10000, max: 10000000 });
  }
  
  /**
   * Generate valid property values
   */
  static propertyValue() {
    return fc.integer({ min: 50000, max: 20000000 });
  }
  
  /**
   * Generate valid interest rates (annual percentage)
   */
  static interestRate() {
    return fc.float({ min: 0.01, max: 15, maxExcluded: true })
      .map(rate => Math.round(rate * 1000) / 1000); // Round to 3 decimals
  }
  
  /**
   * Generate valid loan terms in months
   */
  static loanTermMonths() {
    return fc.oneof(
      fc.constant(60),   // 5 years
      fc.constant(120),  // 10 years
      fc.constant(180),  // 15 years
      fc.constant(240),  // 20 years
      fc.constant(300),  // 25 years
      fc.constant(360)   // 30 years
    );
  }
  
  /**
   * Generate valid credit scores
   */
  static creditScore() {
    return fc.integer({ min: 300, max: 850 });
  }
  
  /**
   * Generate valid annual income
   */
  static annualIncome() {
    return fc.integer({ min: 10000, max: 5000000 });
  }
  
  /**
   * Generate valid monthly debt
   */
  static monthlyDebt() {
    return fc.integer({ min: 0, max: 20000 });
  }
  
  /**
   * Generate valid DSCR property financials
   */
  static dscrProperty(): fc.Arbitrary<PropertyFinancials> {
    return fc.record({
      monthlyRent: fc.integer({ min: 500, max: 50000 }),
      vacancyRate: fc.float({ min: 0, max: 0.5 }),
      propertyTaxes: fc.integer({ min: 500, max: 100000 }),
      insurance: fc.integer({ min: 500, max: 50000 }),
      hoaFees: fc.option(fc.integer({ min: 0, max: 2000 })).map(v => v || undefined),
      utilities: fc.option(fc.integer({ min: 0, max: 1000 })).map(v => v || undefined),
      maintenance: fc.option(fc.integer({ min: 0, max: 2000 })).map(v => v || undefined),
      managementRate: fc.option(fc.float({ min: 0, max: 0.2 })).map(v => v || undefined),
      otherExpenses: fc.option(fc.integer({ min: 0, max: 5000 })).map(v => v || undefined)
    });
  }
  
  /**
   * Generate loan scenarios with correlated values
   */
  static loanScenario() {
    return fc.record({
      propertyValue: PropertyBasedGenerators.propertyValue(),
      downPaymentPercent: fc.float({ min: 3, max: 50 })
    }).chain(({ propertyValue, downPaymentPercent }) => {
      const loanAmount = propertyValue * (1 - downPaymentPercent / 100);
      return fc.record({
        loanAmount: fc.constant(Math.round(loanAmount)),
        propertyValue: fc.constant(propertyValue),
        borrowerIncome: PropertyBasedGenerators.annualIncome(),
        existingMonthlyDebt: PropertyBasedGenerators.monthlyDebt(),
        interestRate: PropertyBasedGenerators.interestRate(),
        termMonths: PropertyBasedGenerators.loanTermMonths()
      });
    });
  }
}

/**
 * Mathematical properties that must hold for mortgage calculations
 */
export class MortgageCalculationProperties {
  private static calculationService = new CalculationService();
  
  /**
   * Property: LTV should always be between 0 and 100
   */
  static ltvBounds() {
    return fc.property(
      PropertyBasedGenerators.loanAmount(),
      PropertyBasedGenerators.propertyValue(),
      (loanAmount, propertyValue) => {
        const ltv = this.calculationService.calculateLTV(loanAmount, propertyValue);
        return ltv >= 0 && ltv <= 100;
      }
    );
  }
  
  /**
   * Property: Monthly payment should increase with loan amount
   */
  static paymentMonotonicity() {
    return fc.property(
      fc.tuple(
        PropertyBasedGenerators.loanAmount(),
        PropertyBasedGenerators.loanAmount()
      ).filter(([a, b]) => a < b),
      PropertyBasedGenerators.interestRate(),
      PropertyBasedGenerators.loanTermMonths(),
      ([loanA, loanB], rate, term) => {
        const paymentA = this.calculationService.calculateMonthlyPayment(loanA, rate, term);
        const paymentB = this.calculationService.calculateMonthlyPayment(loanB, rate, term);
        return paymentA <= paymentB;
      }
    );
  }
  
  /**
   * Property: Total interest + principal should equal total payments
   */
  static paymentConsistency() {
    return fc.property(
      PropertyBasedGenerators.loanAmount(),
      PropertyBasedGenerators.interestRate(),
      PropertyBasedGenerators.loanTermMonths(),
      (principal, rate, term) => {
        const payment = this.calculationService.calculateMonthlyPayment(principal, rate, term);
        const totalPayments = payment * term;
        const metrics = this.calculationService.calculateLoanMetrics({
          loanAmount: principal,
          propertyValue: principal / 0.8, // Assume 80% LTV
          borrowerIncome: 100000, // Arbitrary
          existingMonthlyDebt: 0,
          interestRate: rate,
          termMonths: term
        });
        
        const totalInterest = metrics.totalInterest;
        const difference = Math.abs((principal + totalInterest) - totalPayments);
        
        // Allow for small rounding errors
        return difference < 1;
      }
    );
  }
  
  /**
   * Property: DSCR should be NOI / Debt Service
   */
  static dscrFormula() {
    return fc.property(
      PropertyBasedGenerators.dscrProperty(),
      PropertyBasedGenerators.loanAmount(),
      PropertyBasedGenerators.interestRate(),
      PropertyBasedGenerators.loanTermMonths(),
      (property, loanAmount, rate, term) => {
        const result = this.calculationService.calculateDSCR(
          property,
          loanAmount,
          rate,
          term
        );
        
        if (result.totalDebtService === 0) {
          return result.dscr === 0;
        }
        
        const calculatedDscr = result.netOperatingIncome / result.totalDebtService;
        const difference = Math.abs(result.dscr - calculatedDscr);
        
        // Allow for rounding errors
        return difference < 0.01;
      }
    );
  }
  
  /**
   * Property: Max loan amount should qualify at exactly max DTI
   */
  static maxLoanCalculation() {
    return fc.property(
      fc.integer({ min: 2000, max: 50000 }), // Monthly income
      fc.integer({ min: 0, max: 5000 }),     // Existing debt
      fc.float({ min: 0.28, max: 0.50 }),    // Max DTI
      PropertyBasedGenerators.interestRate(),
      PropertyBasedGenerators.loanTermMonths(),
      (monthlyIncome, existingDebt, maxDTI, rate, term) => {
        const maxLoan = this.calculationService.calculateMaxLoanAmount(
          monthlyIncome,
          existingDebt,
          maxDTI,
          rate / 100,
          term
        );
        
        if (maxLoan === 0) return true; // No loan possible
        
        // Verify the max loan results in DTI at or just below max
        const payment = this.calculationService.calculateMonthlyPayment(maxLoan, rate, term);
        const totalDebt = existingDebt + payment;
        const actualDTI = totalDebt / monthlyIncome;
        
        return actualDTI <= maxDTI && actualDTI >= maxDTI - 0.01;
      }
    );
  }
  
  /**
   * Property: Stress test should always produce worse DSCR
   */
  static stressTestDegradation() {
    return fc.property(
      PropertyBasedGenerators.dscrProperty(),
      PropertyBasedGenerators.loanAmount(),
      PropertyBasedGenerators.interestRate(),
      PropertyBasedGenerators.loanTermMonths(),
      fc.record({
        rentDecrease: fc.float({ min: 0, max: 30 }),
        vacancyIncrease: fc.float({ min: 0, max: 20 }),
        expenseIncrease: fc.float({ min: 0, max: 30 }),
        rateIncrease: fc.float({ min: 0, max: 3 })
      }),
      (property, loanAmount, rate, term, stressScenarios) => {
        const result = this.calculationService.dscrStressTest(
          property,
          loanAmount,
          rate,
          term,
          stressScenarios
        );
        
        // Stressed DSCR should be worse than or equal to baseline
        return result.stressed.dscr <= result.baseline.dscr;
      }
    );
  }
}

/**
 * Property-based test runner
 */
export class PropertyBasedTestRunner {
  /**
   * Run all property tests
   */
  static async runAll(options: fc.Parameters<unknown> = {}) {
    const defaultOptions: fc.Parameters<unknown> = {
      numRuns: 1000,
      seed: Date.now(),
      ...options
    };
    
    const tests = [
      { name: 'LTV Bounds', property: MortgageCalculationProperties.ltvBounds() },
      { name: 'Payment Monotonicity', property: MortgageCalculationProperties.paymentMonotonicity() },
      { name: 'Payment Consistency', property: MortgageCalculationProperties.paymentConsistency() },
      { name: 'DSCR Formula', property: MortgageCalculationProperties.dscrFormula() },
      { name: 'Max Loan Calculation', property: MortgageCalculationProperties.maxLoanCalculation() },
      { name: 'Stress Test Degradation', property: MortgageCalculationProperties.stressTestDegradation() }
    ];
    
    const results = [];
    
    for (const test of tests) {
      try {
        fc.assert(test.property, defaultOptions);
        results.push({ name: test.name, passed: true });
      } catch (error) {
        results.push({ 
          name: test.name, 
          passed: false, 
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return results;
  }
  
  /**
   * Generate edge cases for manual inspection
   */
  static generateEdgeCases() {
    const edgeCases = {
      extremeLTV: fc.sample(
        fc.record({
          loanAmount: fc.oneof(
            fc.constant(1000),           // Very small loan
            fc.constant(50000000)        // Very large loan
          ),
          propertyValue: PropertyBasedGenerators.propertyValue()
        }),
        10
      ),
      
      extremeRates: fc.sample(
        fc.record({
          loanAmount: PropertyBasedGenerators.loanAmount(),
          rate: fc.oneof(
            fc.constant(0),              // Zero interest
            fc.constant(0.01),           // Very low
            fc.constant(25)              // Very high
          ),
          term: PropertyBasedGenerators.loanTermMonths()
        }),
        10
      ),
      
      extremeDSCR: fc.sample(
        fc.record({
          property: fc.oneof(
            // Very low income property
            fc.record({
              monthlyRent: fc.constant(100),
              vacancyRate: fc.constant(0.5),
              propertyTaxes: fc.constant(10000),
              insurance: fc.constant(5000)
            }),
            // Very high income property
            fc.record({
              monthlyRent: fc.constant(100000),
              vacancyRate: fc.constant(0),
              propertyTaxes: fc.constant(1000),
              insurance: fc.constant(500)
            })
          ),
          loanAmount: PropertyBasedGenerators.loanAmount()
        }),
        10
      )
    };
    
    return edgeCases;
  }
}

/**
 * Custom property-based assertions
 */
export class PropertyAssertions {
  /**
   * Assert that a function is monotonic increasing
   */
  static assertMonotonicIncreasing<T>(
    fn: (x: number) => T,
    getValue: (result: T) => number,
    domain: fc.Arbitrary<number>
  ) {
    return fc.property(
      fc.tuple(domain, domain).filter(([a, b]) => a < b),
      ([a, b]) => {
        const resultA = getValue(fn(a));
        const resultB = getValue(fn(b));
        return resultA <= resultB;
      }
    );
  }
  
  /**
   * Assert that a function is commutative
   */
  static assertCommutative<T>(
    fn: (a: T, b: T) => number,
    generator: fc.Arbitrary<T>
  ) {
    return fc.property(
      generator,
      generator,
      (a, b) => {
        const resultAB = fn(a, b);
        const resultBA = fn(b, a);
        return Math.abs(resultAB - resultBA) < 0.0001;
      }
    );
  }
  
  /**
   * Assert that a calculation is deterministic
   */
  static assertDeterministic<T, R>(
    fn: (input: T) => R,
    generator: fc.Arbitrary<T>,
    isEqual: (a: R, b: R) => boolean = (a, b) => a === b
  ) {
    return fc.property(
      generator,
      (input) => {
        const result1 = fn(input);
        const result2 = fn(input);
        return isEqual(result1, result2);
      }
    );
  }
}
