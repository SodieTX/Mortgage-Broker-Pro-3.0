/**
 * Lender Matching Service
 * 
 * BABY STEPS: Simple matching based on state and loan amount only
 * Future: Add all the complex criteria from the schema
 */

import { Pool } from 'pg';
import { logger } from '../utils/logger';

export interface BasicMatchCriteria {
  state: string;
  loanAmount: number;
  propertyType?: string;
}

export interface MatchedLender {
  lenderId: string;
  lenderName: string;
  matchScore: number;
  matchReasons: string[];
  programs: MatchedProgram[];
}

export interface MatchedProgram {
  programId: string;
  programName: string;
  productType: string;
  minLoanAmount?: number;
  maxLoanAmount?: number;
}

export class LenderMatchingService {
  private db: Pool;

  constructor(db: Pool) {
    this.db = db;
  }

  /**
   * BABY STEP: Find lenders that operate in the state and can handle the loan amount
   * This is intentionally simple - just enough to demonstrate value
   */
  async findBasicMatches(criteria: BasicMatchCriteria): Promise<MatchedLender[]> {
    try {
      // Step 1: Find lenders that operate in this state
      const lenderQuery = `
        SELECT DISTINCT 
          l.lender_id,
          l.name as lender_name,
          l.active
        FROM lenders l
        LEFT JOIN lenderstates ls ON l.lender_id = ls.lender_id
        WHERE 
          l.active = true
          AND (
            ls.state_code = $1 
            OR NOT EXISTS (
              SELECT 1 FROM lenderstates WHERE lender_id = l.lender_id
            )
          )
        ORDER BY l.name
      `;

      const lenderResult = await this.db.query(lenderQuery, [criteria.state]);
      
      if (lenderResult.rows.length === 0) {
        logger.info('No lenders found for state', { state: criteria.state });
        return [];
      }

      // Step 2: For each lender, find programs that match loan amount
      const matches: MatchedLender[] = [];
      
      for (const lender of lenderResult.rows) {
        const programQuery = `
          SELECT 
            p.program_id,
            p.name as program_name,
            p.product_type,
            pc_min.hard_min_value as min_loan_amount,
            pc_max.hard_max_value as max_loan_amount
          FROM programs p
          LEFT JOIN programcriteria pc_min ON 
            p.program_id = pc_min.program_id 
            AND p.program_version = pc_min.program_version
            AND pc_min.name = 'min_loan_amount'
          LEFT JOIN programcriteria pc_max ON 
            p.program_id = pc_max.program_id 
            AND p.program_version = pc_max.program_version
            AND pc_max.name = 'max_loan_amount'
          WHERE 
            p.lender_id = $1
            AND p.active = true
            AND p.valid_from <= CURRENT_DATE
            AND p.valid_to >= CURRENT_DATE
            AND (
              pc_min.hard_min_value IS NULL 
              OR pc_min.hard_min_value <= $2
            )
            AND (
              pc_max.hard_max_value IS NULL 
              OR pc_max.hard_max_value >= $2
            )
        `;

        const programResult = await this.db.query(programQuery, [
          lender.lender_id,
          criteria.loanAmount
        ]);

        if (programResult.rows.length > 0) {
          const matchReasons: string[] = [
            `Operates in ${criteria.state}`,
            `Can handle loan amount of $${criteria.loanAmount.toLocaleString()}`
          ];

          matches.push({
            lenderId: lender.lender_id,
            lenderName: lender.lender_name,
            matchScore: 100, // Simple scoring for now
            matchReasons,
            programs: programResult.rows.map(p => ({
              programId: p.program_id,
              programName: p.program_name,
              productType: p.product_type,
              minLoanAmount: p.min_loan_amount ? parseFloat(p.min_loan_amount) : undefined,
              maxLoanAmount: p.max_loan_amount ? parseFloat(p.max_loan_amount) : undefined
            }))
          });
        }
      }

      logger.info('Found lender matches', { 
        state: criteria.state, 
        loanAmount: criteria.loanAmount,
        matchCount: matches.length 
      });

      return matches;

    } catch (error) {
      logger.error('Failed to find lender matches', error);
      throw error;
    }
  }

  /**
   * Get match summary statistics
   */
  async getMatchSummary(matches: MatchedLender[]): Promise<{
    totalLenders: number;
    totalPrograms: number;
    byProductType: Record<string, number>;
  }> {
    const totalPrograms = matches.reduce((sum, lender) => sum + lender.programs.length, 0);
    
    const byProductType: Record<string, number> = {};
    matches.forEach(lender => {
      lender.programs.forEach(program => {
        byProductType[program.productType] = (byProductType[program.productType] || 0) + 1;
      });
    });

    return {
      totalLenders: matches.length,
      totalPrograms,
      byProductType
    };
  }
}
