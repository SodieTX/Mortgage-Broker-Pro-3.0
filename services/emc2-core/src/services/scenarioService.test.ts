/**
 * Scenario Service Tests
 * 
 * Comprehensive tests for scenario management
 */

import { ScenarioService } from './scenarioService';
import { CreateScenarioDTO } from '../types/scenario';

// Mock the database
const mockDb = {
  connect: jest.fn(),
  query: jest.fn(),
};

const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
};

describe('ScenarioService', () => {
  let service: ScenarioService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.connect.mockResolvedValue(mockClient);
    service = new ScenarioService(mockDb as any);
  });
  
  describe('createScenario', () => {
    it('should create a new scenario successfully', async () => {
      const createData: CreateScenarioDTO = {
        title: 'Test Scenario',
        description: 'Test description',
        loanData: {
          borrower: {
            firstName: 'John',
            lastName: 'Doe',
          },
        },
        createdBy: 'test-user',
      };
      
      const mockScenario = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        external_id: null,
        title: createData.title,
        description: createData.description,
        status: 'draft',
        loan_data: createData.loanData,
        created_at: new Date(),
        updated_at: new Date(),
        created_by: createData.createdBy,
        updated_by: null,
        deleted_at: null,
      };
      
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [mockScenario] }) // INSERT
        .mockResolvedValueOnce({}) // log_scenario_event
        .mockResolvedValueOnce({}); // COMMIT
      
      const result = await service.createScenario(createData);
      
      expect(mockDb.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO core.scenarios'),
        expect.arrayContaining([
          null,
          createData.title,
          createData.description,
          JSON.stringify(createData.loanData),
          createData.createdBy,
        ])
      );
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
      
      expect(result.id).toBe(mockScenario.id);
      expect(result.title).toBe(createData.title);
    });
    
    it('should rollback on error', async () => {
      const createData: CreateScenarioDTO = {
        title: 'Test Scenario',
      };
      
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(new Error('Database error')); // INSERT fails
      
      await expect(service.createScenario(createData)).rejects.toThrow('Database error');
      
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });
  
  describe('getScenario', () => {
    it('should return a scenario by ID', async () => {
      const mockScenario = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Test Scenario',
        status: 'draft',
        loan_data: {},
        // ... other fields
      };
      
      mockDb.query.mockResolvedValueOnce({ rows: [mockScenario] });
      
      const result = await service.getScenario(mockScenario.id);
      
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM core.scenarios WHERE id = $1'),
        [mockScenario.id]
      );
      expect(result?.id).toBe(mockScenario.id);
    });
    
    it('should return null if scenario not found', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });
      
      const result = await service.getScenario('non-existent-id');
      
      expect(result).toBeNull();
    });
  });
  
  // Add more test cases as needed...
});
