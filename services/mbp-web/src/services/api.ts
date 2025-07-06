import axios from 'axios';

const API_BASE_URL = import.meta.env.DEV ? '/api/v1' : 'http://localhost:3001/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Types
export interface PropertyFinancials {
  monthlyRent: number;
  vacancyRate: number;
  propertyTaxes: number;
  insurance: number;
  hoaFees?: number;
  utilities?: number;
  maintenance?: number;
  managementRate?: number;
  otherExpenses?: number;
}

export interface DSCRRequest {
  property: PropertyFinancials;
  loanAmount: number;
  interestRate: number;
  termMonths: number;
  minDSCR?: number;
  purchasePrice?: number;
  closingCosts?: number;
}

export interface DSCRResponse {
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

export interface LoanMetricsRequest {
  loanAmount: number;
  propertyValue: number;
  borrowerIncome: number;
  existingMonthlyDebt: number;
  interestRate: number;
  termMonths: number;
}

export interface LoanMetricsResponse {
  loanToValue: number;
  debtToIncome: number;
  monthlyPayment: number;
  totalInterest: number;
  affordabilityScore: number;
  maxLoanAmount: number;
  errors: string[];
  warnings: string[];
  recommendations?: string[];
}

export interface QuickQualifyRequest {
  annualIncome: number;
  creditScore: number;
  downPaymentPercent: number;
}

export interface QuickQualifyResponse {
  likelyApproved: boolean;
  estimatedMaxPurchase: number;
  concerns: string[];
  recommendedPrograms: string[];
  nextSteps: string[];
}

export interface PaymentRequest {
  principal: number;
  annualRate: number;
  termMonths: number;
}

export interface PaymentResponse {
  monthlyPayment: number;
  totalPayments: number;
  totalInterest: number;
  effectiveRate: string;
}

// API Methods
export const calculationsAPI = {
  calculateDSCR: async (data: DSCRRequest) => {
    const response = await api.post('/calculations/dscr', data);
    return response.data;
  },

  calculateDSCRStressTest: async (data: DSCRRequest & { scenarios: any }) => {
    const response = await api.post('/calculations/dscr-stress-test', data);
    return response.data;
  },

  calculateLoanMetrics: async (data: LoanMetricsRequest) => {
    const response = await api.post('/calculations/loan-metrics', data);
    return response.data;
  },

  quickQualify: async (data: QuickQualifyRequest) => {
    const response = await api.post('/calculations/quick-qualify', data);
    return response.data;
  },

  calculatePayment: async (data: PaymentRequest) => {
    const response = await api.post('/calculations/payment', data);
    return response.data;
  },
};

export default api;
