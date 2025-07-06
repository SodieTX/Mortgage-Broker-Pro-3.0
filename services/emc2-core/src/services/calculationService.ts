/**
 * Calculation Service
 * 
 * Real mortgage calculations that brokers actually need
 * This is where we stop being a database and start being a TOOL
 */

// import { LoanData } from '../types/scenario'; // Will use when integrating with scenarios

export interface LoanCalculations {
  loanToValue: number;
  debtToIncome: number;
  monthlyPayment: number;
  totalInterest: number;
  affordabilityScore: number;
  maxLoanAmount: number;
}

export interface CalculationErrors {
  errors: string[];
  warnings: string[];
}

export interface DSCRCalculation {
  dscr: number;
  netOperatingIncome: number;
  totalDebtService: number;
  cashFlow: number;
  breakEvenOccupancy: number;
  loanApproved: boolean;
  maxLoanAmount: number;
  details: {
    grossRentalIncome: number;
    effectiveGrossIncome: number;
    operatingExpenses: number;
    capitalReserves: number;
    managementFees: number;
    annualDebtService: number;
  };
}

export interface PropertyFinancials {
  monthlyRent: number;
  vacancyRate: number; // as decimal (0.05 = 5%)
  propertyTaxes: number; // annual
  insurance: number; // annual
  hoaFees?: number; // monthly
  utilities?: number; // monthly if owner-paid
  maintenance?: number; // monthly estimate
  managementRate?: number; // as decimal (0.08 = 8%)
  otherExpenses?: number; // monthly
}

export class CalculationService {
  /**
   * Calculate Loan-to-Value (LTV) ratio
   * Critical for determining loan eligibility and PMI requirements
   */
  calculateLTV(loanAmount: number, propertyValue: number): number {
    if (propertyValue <= 0) return 0;
    return Math.round((loanAmount / propertyValue) * 10000) / 100; // Round to 2 decimals
  }

  /**
   * Calculate Debt-to-Income (DTI) ratio
   * Most lenders have maximum DTI requirements (typically 43-50%)
   */
  calculateDTI(
    monthlyDebtPayments: number, 
    monthlyGrossIncome: number
  ): number {
    if (monthlyGrossIncome <= 0) return 0;
    return Math.round((monthlyDebtPayments / monthlyGrossIncome) * 10000) / 100;
  }

  /**
   * Calculate monthly mortgage payment (Principal + Interest)
   * Using standard amortization formula
   */
  calculateMonthlyPayment(
    principal: number,
    annualRate: number,
    termMonths: number
  ): number {
    if (annualRate === 0) {
      // No interest loan
      return Math.round((principal / termMonths) * 100) / 100;
    }
    
    const monthlyRate = annualRate / 100 / 12;
    const payment = principal * 
      (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
      (Math.pow(1 + monthlyRate, termMonths) - 1);
    
    return Math.round(payment * 100) / 100;
  }

  /**
   * Calculate maximum loan amount based on income and DTI limits
   * This tells brokers the most their client can borrow
   */
  calculateMaxLoanAmount(
    monthlyIncome: number,
    existingMonthlyDebt: number,
    maxDTI: number = 0.43, // 43% is conventional limit
    annualRate: number = 0.065, // Assume 6.5% if not provided
    termMonths: number = 360
  ): number {
    // Maximum total monthly debt allowed
    const maxTotalDebt = monthlyIncome * maxDTI;
    
    // Available for new mortgage payment
    const availableForMortgage = maxTotalDebt - existingMonthlyDebt;
    
    if (availableForMortgage <= 0) return 0;
    
    // Work backwards from payment to principal
    if (annualRate === 0) {
      return availableForMortgage * termMonths;
    }
    
    const monthlyRate = annualRate / 12;
    const maxLoan = availableForMortgage * 
      (Math.pow(1 + monthlyRate, termMonths) - 1) /
      (monthlyRate * Math.pow(1 + monthlyRate, termMonths));
    
    return Math.round(maxLoan);
  }

  /**
   * Calculate complete loan metrics
   * This is what brokers actually need to advise clients
   */
  calculateLoanMetrics(data: {
    loanAmount: number;
    propertyValue: number;
    borrowerIncome: number; // Annual
    existingMonthlyDebt: number;
    interestRate: number; // Annual percentage
    termMonths: number;
  }): LoanCalculations & CalculationErrors {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Validate inputs
    if (data.loanAmount <= 0) errors.push('Loan amount must be positive');
    if (data.propertyValue <= 0) errors.push('Property value must be positive');
    if (data.borrowerIncome <= 0) errors.push('Borrower income must be positive');
    if (data.interestRate < 0) errors.push('Interest rate cannot be negative');
    if (data.termMonths <= 0) errors.push('Loan term must be positive');
    
    // Calculate metrics
    const ltv = this.calculateLTV(data.loanAmount, data.propertyValue);
    const monthlyIncome = data.borrowerIncome / 12;
    const monthlyPayment = this.calculateMonthlyPayment(
      data.loanAmount,
      data.interestRate,
      data.termMonths
    );
    
    const totalMonthlyDebt = data.existingMonthlyDebt + monthlyPayment;
    const dti = this.calculateDTI(totalMonthlyDebt, monthlyIncome);
    
    const totalInterest = (monthlyPayment * data.termMonths) - data.loanAmount;
    
    const maxLoan = this.calculateMaxLoanAmount(
      monthlyIncome,
      data.existingMonthlyDebt,
      0.43,
      data.interestRate / 100,
      data.termMonths
    );
    
    // Calculate affordability score (0-100)
    let affordabilityScore = 100;
    
    // Deduct points for high LTV
    if (ltv > 95) affordabilityScore -= 30;
    else if (ltv > 90) affordabilityScore -= 20;
    else if (ltv > 80) affordabilityScore -= 10;
    
    // Deduct points for high DTI
    if (dti > 43) affordabilityScore -= 40;
    else if (dti > 36) affordabilityScore -= 20;
    else if (dti > 28) affordabilityScore -= 10;
    
    // Warnings for borderline cases
    if (ltv > 80) warnings.push('LTV > 80% will require PMI');
    if (dti > 36) warnings.push('DTI > 36% may limit lender options');
    if (data.loanAmount > maxLoan) warnings.push('Loan amount exceeds maximum qualifying amount');
    
    return {
      loanToValue: ltv,
      debtToIncome: dti,
      monthlyPayment,
      totalInterest: Math.round(totalInterest),
      affordabilityScore: Math.max(0, affordabilityScore),
      maxLoanAmount: maxLoan,
      errors,
      warnings
    };
  }

  /**
   * Quick pre-qualification check
   * Brokers use this for initial client conversations
   */
  quickQualificationCheck(
    annualIncome: number,
    creditScore: number,
    downPaymentPercent: number
  ): {
    likelyApproved: boolean;
    estimatedMaxPurchase: number;
    concerns: string[];
  } {
    const concerns: string[] = [];
    let likelyApproved = true;
    
    // Credit score checks
    if (creditScore < 580) {
      concerns.push('Credit score below FHA minimum (580)');
      likelyApproved = false;
    } else if (creditScore < 620) {
      concerns.push('Credit score below conventional minimum (620)');
    } else if (creditScore < 740) {
      concerns.push('Credit score may result in higher interest rates');
    }
    
    // Down payment checks
    if (downPaymentPercent < 3) {
      concerns.push('Down payment below FHA minimum (3.5%)');
      likelyApproved = false;
    } else if (downPaymentPercent < 5) {
      concerns.push('Limited to FHA loans with this down payment');
    } else if (downPaymentPercent < 20) {
      concerns.push('PMI will be required');
    }
    
    // Estimate max purchase price (rough calculation)
    const monthlyIncome = annualIncome / 12;
    const maxMonthlyPayment = monthlyIncome * 0.28; // Front-end ratio
    const estimatedMaxLoan = maxMonthlyPayment * 300; // Rough multiplier
    const estimatedMaxPurchase = estimatedMaxLoan / (1 - downPaymentPercent / 100);
    
    return {
      likelyApproved,
      estimatedMaxPurchase: Math.round(estimatedMaxPurchase),
      concerns
    };
  }

  /**
   * Calculate Debt Service Coverage Ratio (DSCR)
   * Essential for investment property loans - most lenders require 1.20-1.25 minimum
   * DSCR = Net Operating Income / Total Debt Service
   */
  calculateDSCR(
    property: PropertyFinancials,
    loanAmount: number,
    interestRate: number, // annual percentage
    termMonths: number,
    minDSCR: number = 1.25 // typical lender requirement
  ): DSCRCalculation {
    // Calculate Gross Rental Income (annual)
    const monthlyGrossRent = property.monthlyRent;
    const annualGrossRent = monthlyGrossRent * 12;
    
    // Calculate Effective Gross Income (accounting for vacancy)
    const vacancyLoss = annualGrossRent * property.vacancyRate;
    const effectiveGrossIncome = annualGrossRent - vacancyLoss;
    
    // Calculate Operating Expenses
    const managementFees = property.managementRate 
      ? effectiveGrossIncome * property.managementRate 
      : 0;
    
    const monthlyExpenses = 
      (property.hoaFees || 0) +
      (property.utilities || 0) +
      (property.maintenance || 0) +
      (property.otherExpenses || 0);
    
    const annualExpenses = 
      property.propertyTaxes +
      property.insurance +
      (monthlyExpenses * 12) +
      managementFees;
    
    // Industry standard: Add capital reserves (typically 5-10% of EGI)
    const capitalReserves = effectiveGrossIncome * 0.05;
    
    const totalOperatingExpenses = annualExpenses + capitalReserves;
    
    // Calculate Net Operating Income (NOI)
    const netOperatingIncome = effectiveGrossIncome - totalOperatingExpenses;
    
    // Calculate Annual Debt Service
    const monthlyPayment = this.calculateMonthlyPayment(
      loanAmount,
      interestRate,
      termMonths
    );
    const annualDebtService = monthlyPayment * 12;
    
    // Calculate DSCR
    let dscr: number;
    if (annualDebtService <= 0) {
      dscr = 0;
    } else if (netOperatingIncome <= 0) {
      dscr = 0; // No income means no coverage
    } else {
      dscr = Math.round((netOperatingIncome / annualDebtService) * 100) / 100;
    }
    
    // Calculate annual cash flow
    const cashFlow = netOperatingIncome - annualDebtService;
    
    // Calculate break-even occupancy
    const breakEvenIncome = totalOperatingExpenses + annualDebtService;
    const breakEvenOccupancy = annualGrossRent > 0
      ? Math.round((breakEvenIncome / annualGrossRent) * 10000) / 100
      : 0;
    
    // Determine if loan would be approved based on DSCR
    const loanApproved = dscr >= minDSCR;
    
    // Calculate maximum loan amount based on DSCR requirement
    const maxAnnualDebtService = netOperatingIncome / minDSCR;
    const maxMonthlyPayment = maxAnnualDebtService / 12;
    
    // Work backwards to find max loan amount
    let maxLoanAmount = 0;
    if (interestRate > 0 && maxMonthlyPayment > 0) {
      const monthlyRate = interestRate / 100 / 12;
      maxLoanAmount = maxMonthlyPayment * 
        (Math.pow(1 + monthlyRate, termMonths) - 1) /
        (monthlyRate * Math.pow(1 + monthlyRate, termMonths));
    }
    
    return {
      dscr,
      netOperatingIncome: Math.round(netOperatingIncome),
      totalDebtService: Math.round(annualDebtService),
      cashFlow: Math.round(cashFlow),
      breakEvenOccupancy,
      loanApproved,
      maxLoanAmount: Math.round(maxLoanAmount),
      details: {
        grossRentalIncome: Math.round(annualGrossRent),
        effectiveGrossIncome: Math.round(effectiveGrossIncome),
        operatingExpenses: Math.round(totalOperatingExpenses),
        capitalReserves: Math.round(capitalReserves),
        managementFees: Math.round(managementFees),
        annualDebtService: Math.round(annualDebtService)
      }
    };
  }

  /**
   * Advanced DSCR analysis with stress testing
   * Shows how DSCR changes under different scenarios
   */
  dscrStressTest(
    property: PropertyFinancials,
    loanAmount: number,
    interestRate: number,
    termMonths: number,
    scenarios?: {
      rentDecrease?: number; // percentage decrease
      vacancyIncrease?: number; // percentage point increase
      expenseIncrease?: number; // percentage increase
      rateIncrease?: number; // percentage point increase
    }
  ): {
    baseline: DSCRCalculation;
    stressed: DSCRCalculation;
    analysis: {
      dscrChange: number;
      stillQualifies: boolean;
      maxRentDecrease: number;
      maxVacancyRate: number;
    };
  } {
    // Calculate baseline DSCR
    const baseline = this.calculateDSCR(
      property,
      loanAmount,
      interestRate,
      termMonths
    );
    
    // Apply stress scenarios
    const stressedProperty = { ...property };
    
    if (scenarios) {
      if (scenarios.rentDecrease) {
        stressedProperty.monthlyRent *= (1 - scenarios.rentDecrease / 100);
      }
      if (scenarios.vacancyIncrease) {
        stressedProperty.vacancyRate += scenarios.vacancyIncrease / 100;
      }
      if (scenarios.expenseIncrease) {
        stressedProperty.propertyTaxes *= (1 + scenarios.expenseIncrease / 100);
        stressedProperty.insurance *= (1 + scenarios.expenseIncrease / 100);
        if (stressedProperty.maintenance) {
          stressedProperty.maintenance *= (1 + scenarios.expenseIncrease / 100);
        }
      }
    }
    
    const stressedInterestRate = scenarios?.rateIncrease 
      ? interestRate + scenarios.rateIncrease 
      : interestRate;
    
    const stressed = this.calculateDSCR(
      stressedProperty,
      loanAmount,
      stressedInterestRate,
      termMonths
    );
    
    // Find maximum rent decrease before DSCR falls below 1.25
    let maxRentDecrease = 0;
    if (baseline.dscr >= 1.25) {
      for (let decrease = 0; decrease <= 50; decrease += 1) {
        const testProperty = { ...property };
        testProperty.monthlyRent = property.monthlyRent * (1 - decrease / 100);
        const testDSCR = this.calculateDSCR(
          testProperty,
          loanAmount,
          interestRate,
          termMonths
        );
        if (testDSCR.dscr < 1.25) {
          maxRentDecrease = Math.max(0, decrease - 1);
          break;
        }
        maxRentDecrease = decrease;
      }
    }
    
    // Find maximum vacancy rate before DSCR falls below 1.25
    let maxVacancyRate = property.vacancyRate;
    for (let vacancy = property.vacancyRate; vacancy <= 0.5; vacancy += 0.01) {
      const testProperty = { ...property };
      testProperty.vacancyRate = vacancy;
      const testDSCR = this.calculateDSCR(
        testProperty,
        loanAmount,
        interestRate,
        termMonths
      );
      if (testDSCR.dscr < 1.25) {
        maxVacancyRate = vacancy - 0.01;
        break;
      }
      maxVacancyRate = vacancy;
    }
    
    return {
      baseline,
      stressed,
      analysis: {
        dscrChange: stressed.dscr - baseline.dscr,
        stillQualifies: stressed.dscr >= 1.25,
        maxRentDecrease,
        maxVacancyRate: Math.round(maxVacancyRate * 10000) / 100
      }
    };
  }

  /**
   * Calculate Cap Rate and other investment metrics
   * Helps brokers evaluate investment property deals
   */
  calculateInvestmentMetrics(
    property: PropertyFinancials,
    purchasePrice: number,
    loanAmount: number,
    interestRate: number,
    termMonths: number,
    closingCosts: number = 0
  ): {
    capRate: number;
    cashOnCashReturn: number;
    totalReturn: number;
    monthlyProfit: number;
    breakEvenYears: number;
    metrics: {
      totalInvestment: number;
      annualCashFlow: number;
      effectiveCapRate: number;
      loanToValue: number;
    };
  } {
    // Calculate DSCR and NOI
    const dscr = this.calculateDSCR(
      property,
      loanAmount,
      interestRate,
      termMonths
    );
    
    // Calculate Cap Rate (NOI / Purchase Price)
    const capRate = purchasePrice > 0
      ? (dscr.netOperatingIncome / purchasePrice) * 100
      : 0;
    
    // Calculate total cash investment
    const downPayment = purchasePrice - loanAmount;
    const totalInvestment = downPayment + closingCosts;
    
    // Calculate Cash-on-Cash Return
    const annualCashFlow = dscr.cashFlow;
    const cashOnCashReturn = totalInvestment > 0
      ? (annualCashFlow / totalInvestment) * 100
      : 0;
    
    // Calculate monthly profit
    const monthlyProfit = annualCashFlow / 12;
    
    // Calculate break-even time
    const breakEvenYears = annualCashFlow > 0
      ? totalInvestment / annualCashFlow
      : 0;
    
    // Calculate total return (including principal paydown)
    // First year principal paydown approximation
    const firstYearInterest = loanAmount * (interestRate / 100);
    const firstYearPrincipal = dscr.totalDebtService - firstYearInterest;
    const totalReturn = totalInvestment > 0
      ? ((annualCashFlow + firstYearPrincipal) / totalInvestment) * 100
      : 0;
    
    // Effective cap rate (after all expenses including reserves)
    const effectiveCapRate = purchasePrice > 0
      ? ((dscr.netOperatingIncome - dscr.details.capitalReserves) / purchasePrice) * 100
      : 0;
    
    return {
      capRate: Math.round(capRate * 100) / 100,
      cashOnCashReturn: Math.round(cashOnCashReturn * 100) / 100,
      totalReturn: Math.round(totalReturn * 100) / 100,
      monthlyProfit: Math.round(monthlyProfit),
      breakEvenYears: Math.round(breakEvenYears * 10) / 10,
      metrics: {
        totalInvestment: Math.round(totalInvestment),
        annualCashFlow: Math.round(annualCashFlow),
        effectiveCapRate: Math.round(effectiveCapRate * 100) / 100,
        loanToValue: Math.round((loanAmount / purchasePrice) * 10000) / 100
      }
    };
  }
}
