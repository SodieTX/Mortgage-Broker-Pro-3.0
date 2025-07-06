/**
 * Calculations API Routes
 * 
 * This is where brokers get ANSWERS, not just data storage
 * Real-time calculations for loan scenarios
 */

import { FastifyPluginAsync } from 'fastify';
import { CalculationService, PropertyFinancials } from '../services/calculationService';

const calculationService = new CalculationService();

// Type definitions for request bodies
interface LoanMetricsBody {
  loanAmount: number;
  propertyValue: number;
  borrowerIncome: number;
  existingMonthlyDebt: number;
  interestRate: number;
  termMonths: number;
}

interface DSCRBody {
  property: PropertyFinancials;
  loanAmount: number;
  interestRate: number;
  termMonths: number;
  minDSCR?: number;
  purchasePrice?: number;
  closingCosts?: number;
}

interface DSCRStressTestBody extends DSCRBody {
  scenarios?: {
    rentDecrease?: number;
    vacancyIncrease?: number;
    expenseIncrease?: number;
    rateIncrease?: number;
  };
}

interface QuickQualifyBody {
  annualIncome: number;
  creditScore: number;
  downPaymentPercent: number;
}

interface PaymentBody {
  principal: number;
  annualRate: number;
  termMonths: number;
}

// Schema definitions for validation
const loanMetricsSchema = {
  body: {
    type: 'object',
    required: ['loanAmount', 'propertyValue', 'borrowerIncome', 'existingMonthlyDebt', 'interestRate', 'termMonths'],
    properties: {
      loanAmount: { type: 'number', minimum: 1000 },
      propertyValue: { type: 'number', minimum: 1000 },
      borrowerIncome: { type: 'number', minimum: 1 },
      existingMonthlyDebt: { type: 'number', minimum: 0 },
      interestRate: { type: 'number', minimum: 0, maximum: 50 },
      termMonths: { type: 'integer', minimum: 1, maximum: 480 }
    }
  }
};

const dscrSchema = {
  body: {
    type: 'object',
    required: ['property', 'loanAmount', 'interestRate', 'termMonths'],
    properties: {
      property: {
        type: 'object',
        required: ['monthlyRent', 'vacancyRate', 'propertyTaxes', 'insurance'],
        properties: {
          monthlyRent: { type: 'number', minimum: 0 },
          vacancyRate: { type: 'number', minimum: 0, maximum: 1 },
          propertyTaxes: { type: 'number', minimum: 0 },
          insurance: { type: 'number', minimum: 0 },
          hoaFees: { type: 'number', minimum: 0 },
          utilities: { type: 'number', minimum: 0 },
          maintenance: { type: 'number', minimum: 0 },
          managementRate: { type: 'number', minimum: 0, maximum: 1 },
          otherExpenses: { type: 'number', minimum: 0 }
        }
      },
      loanAmount: { type: 'number', minimum: 1000 },
      interestRate: { type: 'number', minimum: 0, maximum: 50 },
      termMonths: { type: 'integer', minimum: 1, maximum: 480 },
      minDSCR: { type: 'number', minimum: 0 },
      purchasePrice: { type: 'number', minimum: 0 },
      closingCosts: { type: 'number', minimum: 0 }
    }
  }
};

const quickQualifySchema = {
  body: {
    type: 'object',
    required: ['annualIncome', 'creditScore', 'downPaymentPercent'],
    properties: {
      annualIncome: { type: 'number', minimum: 1 },
      creditScore: { type: 'integer', minimum: 300, maximum: 850 },
      downPaymentPercent: { type: 'number', minimum: 0, maximum: 100 }
    }
  }
};

const paymentSchema = {
  body: {
    type: 'object',
    required: ['principal', 'annualRate', 'termMonths'],
    properties: {
      principal: { type: 'number', minimum: 1000 },
      annualRate: { type: 'number', minimum: 0, maximum: 50 },
      termMonths: { type: 'integer', minimum: 1, maximum: 480 }
    }
  }
};

export const calculationRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /calculations/loan-metrics
   * Calculate comprehensive loan metrics including LTV, DTI, affordability
   */
  fastify.post<{ Body: LoanMetricsBody }>(
    '/calculations/loan-metrics',
    { schema: loanMetricsSchema },
    async (request, reply) => {
      try {
        const result = calculationService.calculateLoanMetrics(request.body);
        
        // Add helpful context for the broker
        const recommendations: string[] = [];
        
        if (result.loanToValue > 80) {
          recommendations.push('Consider larger down payment to avoid PMI');
        }
        if (result.debtToIncome > 43) {
          recommendations.push('DTI exceeds conventional loan limits - explore non-QM options');
        }
        if (result.affordabilityScore < 50) {
          recommendations.push('Borrower may struggle with this loan - consider lower amount');
        }
        
        return {
          success: true,
          data: {
            ...result,
            recommendations
          }
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        fastify.log.error({ error: message }, 'Failed to calculate loan metrics');
        return reply.code(500).send({
          success: false,
          error: 'Failed to calculate loan metrics',
          message
        });
      }
    }
  );

  /**
   * POST /calculations/dscr
   * Calculate Debt Service Coverage Ratio for investment properties
   */
  fastify.post<{ Body: DSCRBody }>(
    '/calculations/dscr',
    { schema: dscrSchema },
    async (request, reply) => {
      try {
        const { property, loanAmount, interestRate, termMonths, minDSCR } = request.body;
        
        const result = calculationService.calculateDSCR(
          property,
          loanAmount,
          interestRate,
          termMonths,
          minDSCR || 1.25
        );
        
        // Add investment metrics for complete picture
        const investmentMetrics = calculationService.calculateInvestmentMetrics(
          property,
          request.body.purchasePrice || loanAmount / 0.8, // Assume 80% LTV if not provided
          loanAmount,
          interestRate,
          termMonths,
          request.body.closingCosts || 0
        );
        
        return {
          success: true,
          data: {
            dscr: result,
            investment: investmentMetrics,
            summary: {
              qualified: result.loanApproved,
              monthlyProfit: investmentMetrics.monthlyProfit,
              yearOneReturn: investmentMetrics.cashOnCashReturn,
              maxQualifyingLoan: result.maxLoanAmount
            }
          }
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        fastify.log.error({ error: message }, 'Failed to calculate DSCR');
        return reply.code(500).send({
          success: false,
          error: 'Failed to calculate DSCR',
          message
        });
      }
    }
  );

  /**
   * POST /calculations/dscr-stress-test
   * Stress test DSCR under various scenarios
   */
  fastify.post<{ Body: DSCRStressTestBody }>(
    '/calculations/dscr-stress-test',
    { 
      schema: {
        ...dscrSchema,
        body: {
          ...dscrSchema.body,
          properties: {
            ...dscrSchema.body.properties,
            scenarios: {
              type: 'object',
              properties: {
                rentDecrease: { type: 'number', minimum: 0, maximum: 100 },
                vacancyIncrease: { type: 'number', minimum: 0, maximum: 100 },
                expenseIncrease: { type: 'number', minimum: 0, maximum: 100 },
                rateIncrease: { type: 'number', minimum: 0, maximum: 10 }
              }
            }
          }
        }
      }
    },
    async (request, reply) => {
      try {
        const { property, loanAmount, interestRate, termMonths, scenarios } = request.body;
        
        const result = calculationService.dscrStressTest(
          property,
          loanAmount,
          interestRate,
          termMonths,
          scenarios
        );
        
        // Provide risk assessment
        const riskLevel = 
          result.analysis.stillQualifies ? 'Low' :
          result.baseline.dscr >= 1.4 ? 'Medium' : 'High';
        
        return {
          success: true,
          data: {
            ...result,
            riskAssessment: {
              level: riskLevel,
              maxSafeRentDecrease: `${result.analysis.maxRentDecrease}%`,
              maxSafeVacancy: `${result.analysis.maxVacancyRate}%`,
              stressTestPassed: result.analysis.stillQualifies
            }
          }
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        fastify.log.error({ error: message }, 'Failed to perform stress test');
        return reply.code(500).send({
          success: false,
          error: 'Failed to perform stress test',
          message
        });
      }
    }
  );

  /**
   * POST /calculations/quick-qualify
   * Quick pre-qualification check
   */
  fastify.post<{ Body: QuickQualifyBody }>(
    '/calculations/quick-qualify',
    { schema: quickQualifySchema },
    async (request, reply) => {
      try {
        const { annualIncome, creditScore, downPaymentPercent } = request.body;
        
        const result = calculationService.quickQualificationCheck(
          annualIncome,
          creditScore,
          downPaymentPercent
        );
        
        // Add loan program recommendations
        const programs: string[] = [];
        if (creditScore >= 620 && downPaymentPercent >= 5) {
          programs.push('Conventional');
        }
        if (creditScore >= 580 && downPaymentPercent >= 3.5) {
          programs.push('FHA');
        }
        if (creditScore >= 640) {
          programs.push('VA (if eligible)');
        }
        if (downPaymentPercent >= 25) {
          programs.push('DSCR/Investment');
        }
        
        return {
          success: true,
          data: {
            ...result,
            recommendedPrograms: programs,
            nextSteps: result.likelyApproved 
              ? ['Gather income documentation', 'Get pre-approval letter', 'Start house hunting']
              : ['Work on credit improvement', 'Save for larger down payment', 'Reduce existing debts']
          }
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        fastify.log.error({ error: message }, 'Failed to perform qualification check');
        return reply.code(500).send({
          success: false,
          error: 'Failed to perform qualification check',
          message
        });
      }
    }
  );

  /**
   * POST /calculations/payment
   * Simple monthly payment calculation
   */
  fastify.post<{ Body: PaymentBody }>(
    '/calculations/payment',
    { schema: paymentSchema },
    async (request, reply) => {
      try {
        const { principal, annualRate, termMonths } = request.body;
        
        const monthlyPayment = calculationService.calculateMonthlyPayment(
          principal,
          annualRate,
          termMonths
        );
        
        const totalPayments = monthlyPayment * termMonths;
        const totalInterest = totalPayments - principal;
        
        return {
          success: true,
          data: {
            monthlyPayment,
            totalPayments: Math.round(totalPayments),
            totalInterest: Math.round(totalInterest),
            effectiveRate: principal > 0 ? ((totalInterest / principal) * 100).toFixed(2) + '%' : '0%'
          }
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        fastify.log.error({ error: message }, 'Failed to calculate payment');
        return reply.code(500).send({
          success: false,
          error: 'Failed to calculate payment',
          message
        });
      }
    }
  );
};
