/**
 * Tests for LenderMatchingService
 * Tests basic lender matching functionality
 */

import { Pool } from 'pg';
import { LenderMatchingService, BasicMatchCriteria, MatchedLender } from '../lenderMatchingService';

// Mock the logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn()
  }
}));

describe('LenderMatchingService', () => {
  let mockDb: jest.Mocked<Pool>;
  let service: LenderMatchingService;

  beforeEach(() => {
    mockDb = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    } as any;
    
    service = new LenderMatchingService(mockDb);
  });

  describe('constructor', () => {
    it('should create an instance', () => {
      expect(service).toBeInstanceOf(LenderMatchingService);
    });
  });

  describe('findBasicMatches', () => {
    const mockCriteria: BasicMatchCriteria = {
      state: 'CA',
      loanAmount: 500000,
      propertyType: 'SFR'
    };

    it('should find matching lenders and programs', async () => {
      // Reset and configure mock
      mockDb.query.mockReset();
      
      // Mock lender query result
      mockDb.query.mockResolvedValueOnce({
        rows: [
          { lender_id: 'lender1', lender_name: 'Lender One', active: true },
          { lender_id: 'lender2', lender_name: 'Lender Two', active: true }
        ]
      } as any);

      // Mock program query results
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              program_id: 'prog1',
              program_name: 'Program One',
              product_type: 'Conventional',
              min_loan_amount: '100000',
              max_loan_amount: '1000000'
            }
          ]
        } as any)
        .mockResolvedValueOnce({
          rows: [
            {
              program_id: 'prog2',
              program_name: 'Program Two',
              product_type: 'FHA',
              min_loan_amount: '200000',
              max_loan_amount: '800000'
            }
          ]
        } as any);

      const result = await service.findBasicMatches(mockCriteria);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        lenderId: 'lender1',
        lenderName: 'Lender One',
        matchScore: 100,
        matchReasons: [
          'Operates in CA',
          'Can handle loan amount of $500,000'
        ],
        programs: [
          {
            programId: 'prog1',
            programName: 'Program One',
            productType: 'Conventional',
            minLoanAmount: 100000,
            maxLoanAmount: 1000000
          }
        ]
      });
      
      expect(mockDb.query).toHaveBeenCalledTimes(3);
    });

    it('should return empty array when no lenders found', async () => {
      mockDb.query.mockReset();
      mockDb.query.mockResolvedValueOnce({
        rows: []
      } as any);

      const result = await service.findBasicMatches(mockCriteria);

      expect(result).toEqual([]);
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    it('should skip lenders with no matching programs', async () => {
      mockDb.query.mockReset();
      // Mock lender query result
      mockDb.query.mockResolvedValueOnce({
        rows: [
          { lender_id: 'lender1', lender_name: 'Lender One', active: true }
        ]
      } as any);

      // Mock program query with no results
      mockDb.query.mockResolvedValueOnce({
        rows: []
      } as any);

      const result = await service.findBasicMatches(mockCriteria);

      expect(result).toEqual([]);
      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });

    it('should handle database errors', async () => {
      mockDb.query.mockReset();
      const error = new Error('Database connection failed');
      mockDb.query.mockRejectedValueOnce(error);

      await expect(service.findBasicMatches(mockCriteria)).rejects.toThrow('Database connection failed');
    });

    it('should call database with correct parameters', async () => {
      mockDb.query.mockReset();
      mockDb.query.mockResolvedValueOnce({
        rows: [
          { lender_id: 'lender1', lender_name: 'Lender One', active: true }
        ]
      } as any);

      mockDb.query.mockResolvedValueOnce({
        rows: []
      } as any);

      await service.findBasicMatches(mockCriteria);

      // Check lender query parameters
      expect(mockDb.query).toHaveBeenNthCalledWith(1, expect.any(String), ['CA']);
      
      // Check program query parameters  
      expect(mockDb.query).toHaveBeenNthCalledWith(2, expect.any(String), ['lender1', 500000]);
    });

    it('should handle programs with null min/max amounts', async () => {
      mockDb.query.mockReset();
      mockDb.query.mockResolvedValueOnce({
        rows: [
          { lender_id: 'lender1', lender_name: 'Lender One', active: true }
        ]
      } as any);

      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            program_id: 'prog1',
            program_name: 'Program One',
            product_type: 'Conventional',
            min_loan_amount: null,
            max_loan_amount: null
          }
        ]
      } as any);

      const result = await service.findBasicMatches(mockCriteria);

      expect(result[0].programs[0]).toEqual({
        programId: 'prog1',
        programName: 'Program One',
        productType: 'Conventional',
        minLoanAmount: undefined,
        maxLoanAmount: undefined
      });
    });

    it('should handle multiple programs per lender', async () => {
      mockDb.query.mockReset();
      mockDb.query.mockResolvedValueOnce({
        rows: [
          { lender_id: 'lender1', lender_name: 'Lender One', active: true }
        ]
      } as any);

      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            program_id: 'prog1',
            program_name: 'Program One',
            product_type: 'Conventional',
            min_loan_amount: '100000',
            max_loan_amount: '1000000'
          },
          {
            program_id: 'prog2',
            program_name: 'Program Two',
            product_type: 'FHA',
            min_loan_amount: '200000',
            max_loan_amount: '800000'
          }
        ]
      } as any);

      const result = await service.findBasicMatches(mockCriteria);

      expect(result[0].programs).toHaveLength(2);
      expect(result[0].programs[0].programId).toBe('prog1');
      expect(result[0].programs[1].programId).toBe('prog2');
    });
  });

  describe('getMatchSummary', () => {
    it('should calculate correct summary statistics', async () => {
      const mockMatches: MatchedLender[] = [
        {
          lenderId: 'lender1',
          lenderName: 'Lender One',
          matchScore: 100,
          matchReasons: ['test'],
          programs: [
            {
              programId: 'prog1',
              programName: 'Program One',
              productType: 'Conventional',
              minLoanAmount: 100000,
              maxLoanAmount: 1000000
            },
            {
              programId: 'prog2',
              programName: 'Program Two',
              productType: 'FHA',
              minLoanAmount: 200000,
              maxLoanAmount: 800000
            }
          ]
        },
        {
          lenderId: 'lender2',
          lenderName: 'Lender Two',
          matchScore: 100,
          matchReasons: ['test'],
          programs: [
            {
              programId: 'prog3',
              programName: 'Program Three',
              productType: 'Conventional',
              minLoanAmount: 150000,
              maxLoanAmount: 900000
            }
          ]
        }
      ];

      const result = await service.getMatchSummary(mockMatches);

      expect(result).toEqual({
        totalLenders: 2,
        totalPrograms: 3,
        byProductType: {
          'Conventional': 2,
          'FHA': 1
        }
      });
    });

    it('should handle empty matches array', async () => {
      const result = await service.getMatchSummary([]);

      expect(result).toEqual({
        totalLenders: 0,
        totalPrograms: 0,
        byProductType: {}
      });
    });

    it('should handle single match with multiple programs', async () => {
      const mockMatches: MatchedLender[] = [
        {
          lenderId: 'lender1',
          lenderName: 'Lender One',
          matchScore: 100,
          matchReasons: ['test'],
          programs: [
            {
              programId: 'prog1',
              programName: 'Program One',
              productType: 'VA',
              minLoanAmount: 100000,
              maxLoanAmount: 1000000
            },
            {
              programId: 'prog2',
              programName: 'Program Two',
              productType: 'VA',
              minLoanAmount: 200000,
              maxLoanAmount: 800000
            }
          ]
        }
      ];

      const result = await service.getMatchSummary(mockMatches);

      expect(result).toEqual({
        totalLenders: 1,
        totalPrograms: 2,
        byProductType: {
          'VA': 2
        }
      });
    });

    it('should handle matches with no programs', async () => {
      const mockMatches: MatchedLender[] = [
        {
          lenderId: 'lender1',
          lenderName: 'Lender One',
          matchScore: 100,
          matchReasons: ['test'],
          programs: []
        }
      ];

      const result = await service.getMatchSummary(mockMatches);

      expect(result).toEqual({
        totalLenders: 1,
        totalPrograms: 0,
        byProductType: {}
      });
    });
  });
});