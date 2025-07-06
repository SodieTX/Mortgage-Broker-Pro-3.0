import { CalculationService } from './calculationService';

describe('CalculationService - DSCR Calculations', () => {
  let service: CalculationService;

  beforeEach(() => {
    service = new CalculationService();
  });

  describe('calculateDSCR', () => {
    it('should calculate DSCR correctly for a profitable rental property', () => {
      const property = {
        monthlyRent: 4500, // Higher rent for better DSCR
        vacancyRate: 0.05, // 5% vacancy
        propertyTaxes: 6000, // annual
        insurance: 1800, // annual
        hoaFees: 200, // monthly
        maintenance: 150, // monthly
        managementRate: 0.08, // 8% management fee
      };

      const result = service.calculateDSCR(
        property,
        400000, // loan amount
        6.5, // interest rate
        360 // 30-year term
      );

      // Verify calculations
      expect(result.dscr).toBeGreaterThan(1.0);
      expect(result.netOperatingIncome).toBeGreaterThan(0);
      expect(result.loanApproved).toBe(result.dscr >= 1.25);
      expect(result.details.grossRentalIncome).toBe(54000); // 4500 * 12
      expect(result.details.effectiveGrossIncome).toBe(51300); // 54000 * 0.95
    });

    it('should reject loan when DSCR is below minimum', () => {
      const property = {
        monthlyRent: 1500, // Low rent
        vacancyRate: 0.10, // High vacancy
        propertyTaxes: 8000,
        insurance: 2000,
        hoaFees: 300,
        maintenance: 200,
        managementRate: 0.10,
      };

      const result = service.calculateDSCR(
        property,
        400000,
        7.0, // Higher rate
        360
      );

      expect(result.dscr).toBeLessThan(1.25);
      expect(result.loanApproved).toBe(false);
      expect(result.cashFlow).toBeLessThan(0); // Negative cash flow
    });

    it('should calculate break-even occupancy correctly', () => {
      const property = {
        monthlyRent: 3500, // Higher rent for reasonable break-even
        vacancyRate: 0.05,
        propertyTaxes: 5000,
        insurance: 1500,
        hoaFees: 150,
        utilities: 100,
        maintenance: 100,
        managementRate: 0.08,
      };

      const result = service.calculateDSCR(
        property,
        300000,
        6.0,
        360
      );

      // Break-even occupancy should be between 0 and 100%
      expect(result.breakEvenOccupancy).toBeGreaterThan(0);
      expect(result.breakEvenOccupancy).toBeLessThanOrEqual(100); // Can be exactly 100%
    });

    it('should calculate maximum loan amount based on DSCR', () => {
      const property = {
        monthlyRent: 4000,
        vacancyRate: 0.05,
        propertyTaxes: 7000,
        insurance: 2000,
        maintenance: 200,
        managementRate: 0.08,
      };

      const result = service.calculateDSCR(
        property,
        500000, // Current loan amount
        6.5,
        360,
        1.25 // minimum DSCR
      );

      // Max loan should be calculated
      expect(result.maxLoanAmount).toBeGreaterThan(0);
      
      // If we're asking for more than max, loan should not be approved
      if (500000 > result.maxLoanAmount) {
        expect(result.loanApproved).toBe(false);
      }
    });
  });

  describe('dscrStressTest', () => {
    it('should perform stress test analysis', () => {
      const property = {
        monthlyRent: 3500,
        vacancyRate: 0.05,
        propertyTaxes: 6000,
        insurance: 1800,
        maintenance: 150,
        managementRate: 0.08,
      };

      const result = service.dscrStressTest(
        property,
        350000,
        6.5,
        360,
        {
          rentDecrease: 10, // 10% rent decrease
          vacancyIncrease: 5, // 5% more vacancy
          expenseIncrease: 15, // 15% expense increase
          rateIncrease: 1, // 1% rate increase
        }
      );

      // Baseline should be better than stressed
      expect(result.baseline.dscr).toBeGreaterThan(result.stressed.dscr);
      expect(result.analysis.dscrChange).toBeLessThan(0); // Negative change
      
      // Should provide max tolerances
      expect(result.analysis.maxRentDecrease).toBeGreaterThanOrEqual(0);
      expect(result.analysis.maxVacancyRate).toBeGreaterThan(property.vacancyRate);
    });
  });

  describe('calculateInvestmentMetrics', () => {
    it('should calculate investment returns correctly', () => {
      const property = {
        monthlyRent: 3000,
        vacancyRate: 0.05,
        propertyTaxes: 5000,
        insurance: 1500,
        hoaFees: 100,
        maintenance: 150,
        managementRate: 0.08,
      };

      const purchasePrice = 500000;
      const loanAmount = 400000;
      const closingCosts = 10000;

      const result = service.calculateInvestmentMetrics(
        property,
        purchasePrice,
        loanAmount,
        6.5,
        360,
        closingCosts
      );

      // Cap rate should be reasonable (typically 4-10% for residential)
      expect(result.capRate).toBeGreaterThan(0);
      expect(result.capRate).toBeLessThan(20);

      // Cash on cash return depends on leverage
      expect(result.cashOnCashReturn).toBeDefined();
      
      // Total investment should be down payment + closing costs
      expect(result.metrics.totalInvestment).toBe(110000); // 100k down + 10k closing
      
      // LTV should match our inputs
      expect(result.metrics.loanToValue).toBe(80); // 400k/500k = 80%
    });

    it('should handle negative cash flow scenarios', () => {
      const property = {
        monthlyRent: 1800,
        vacancyRate: 0.10,
        propertyTaxes: 8000,
        insurance: 2500,
        hoaFees: 250,
        maintenance: 200,
        managementRate: 0.10,
      };

      const result = service.calculateInvestmentMetrics(
        property,
        500000,
        450000,
        7.0,
        360,
        12000
      );

      // With high expenses and low rent, cash flow might be negative
      if (result.metrics.annualCashFlow < 0) {
        expect(result.cashOnCashReturn).toBeLessThan(0);
        expect(result.monthlyProfit).toBeLessThan(0);
        expect(result.breakEvenYears).toBe(0); // Never breaks even
      }
    });
  });

  describe('Edge cases', () => {
    it('should handle zero rent property', () => {
      const property = {
        monthlyRent: 0,
        vacancyRate: 0,
        propertyTaxes: 5000,
        insurance: 1500,
      };

      const result = service.calculateDSCR(
        property,
        300000,
        6.5,
        360
      );

      expect(result.dscr).toBe(0);
      expect(result.loanApproved).toBe(false);
      expect(result.netOperatingIncome).toBeLessThan(0);
    });

    it('should handle very high interest rates', () => {
      const property = {
        monthlyRent: 3000,
        vacancyRate: 0.05,
        propertyTaxes: 5000,
        insurance: 1500,
        maintenance: 150,
        managementRate: 0.08,
      };

      const result = service.calculateDSCR(
        property,
        400000,
        12.0, // Very high rate
        360
      );

      // High interest = high debt service = low DSCR
      expect(result.dscr).toBeLessThan(1.25);
      expect(result.totalDebtService).toBeGreaterThan(result.netOperatingIncome);
    });
  });
});
