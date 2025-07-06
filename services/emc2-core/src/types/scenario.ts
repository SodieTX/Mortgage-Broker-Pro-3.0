/**
 * Scenario Types
 * 
 * Clear, simple types for loan scenarios
 */

export type ScenarioStatus = 'draft' | 'submitted' | 'processing' | 'evaluated' | 'error' | 'archived';

export interface LoanData {
  // Borrower information
  borrower?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    creditScore?: number;
    annualIncome?: number;
  };
  
  // Property information
  property?: {
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    propertyType?: string;
    purchasePrice?: number;
    estimatedValue?: number;
  };
  
  // Loan information
  loan?: {
    loanAmount?: number;
    loanPurpose?: 'purchase' | 'refinance' | 'cashout';
    loanType?: 'conventional' | 'fha' | 'va' | 'jumbo';
    termMonths?: number;
  };
  
  // Additional fields can be added as needed
  [key: string]: any;
}

export interface Scenario {
  id: string;
  externalId?: string;
  title: string;
  description?: string;
  status: ScenarioStatus;
  loanData: LoanData;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  deletedAt?: Date;
}

export interface CreateScenarioDTO {
  externalId?: string;
  title: string;
  description?: string;
  loanData?: LoanData;
  createdBy?: string;
}

export interface UpdateScenarioDTO {
  title?: string;
  description?: string;
  status?: ScenarioStatus;
  loanData?: LoanData;
  updatedBy?: string;
}

export interface ScenarioEvent {
  id: string;
  scenarioId: string;
  eventType: string;
  eventData: Record<string, any>;
  createdAt: Date;
  createdBy?: string;
}
