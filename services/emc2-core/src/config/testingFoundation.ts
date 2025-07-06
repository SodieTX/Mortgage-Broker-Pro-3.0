/**
 * Testing Foundation Configuration
 * Mary Poppins' World-Class Testing Setup
 */

import { jest } from '@jest/globals';

export interface TestConfig {
  coverageThreshold: {
    global: {
      branches: number;
      functions: number;
      lines: number;
      statements: number;
    };
  };
  testMatch: string[];
  setupFilesAfterEnv: string[];
  testEnvironment: string;
  clearMocks: boolean;
  resetMocks: boolean;
  restoreMocks: boolean;
}

export const TESTING_STANDARDS: TestConfig = {
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/*.test.ts',
    '**/*.spec.ts'
  ],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  testEnvironment: 'node',
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true
};

/**
 * Test Quality Gates
 */
export const QUALITY_GATES = {
  // Minimum coverage required for each file
  FILE_COVERAGE_MINIMUM: 70,
  
  // Maximum test execution time (ms)
  MAX_TEST_DURATION: 5000,
  
  // Maximum number of skipped tests allowed
  MAX_SKIPPED_TESTS: 0,
  
  // Required test types
  REQUIRED_TEST_TYPES: [
    'unit',
    'integration',
    'e2e'
  ]
};

/**
 * Test Utilities
 */
export class TestFoundation {
  /**
   * Create a test database connection
   */
  static async createTestDatabase() {
    // Implementation for test database
    return {
      query: jest.fn(),
      end: jest.fn()
    };
  }
  
  /**
   * Create a test Redis connection
   */
  static async createTestRedis() {
    // Implementation for test Redis
    return {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      quit: jest.fn()
    };
  }
  
  /**
   * Clean up test data
   */
  static async cleanupTestData() {
    // Implementation for cleanup
  }
  
  /**
   * Generate test fixtures
   */
  static generateFixtures() {
    return {
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User'
      },
      scenario: {
        id: 'test-scenario-id',
        title: 'Test Scenario',
        data: {
          purchasePrice: 500000,
          downPayment: 100000,
          interestRate: 5.5,
          loanTerm: 30
        }
      }
    };
  }
}

/**
 * Test Matchers
 */
export const customMatchers = {
  toBeValidUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    
    return {
      message: () =>
        pass
          ? `expected ${received} not to be a valid UUID`
          : `expected ${received} to be a valid UUID`,
      pass,
    };
  },
  
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    
    return {
      message: () =>
        pass
          ? `expected ${received} not to be within range ${floor} - ${ceiling}`
          : `expected ${received} to be within range ${floor} - ${ceiling}`,
      pass,
    };
  },
  
  toHaveValidSchema(received: any, schema: any) {
    // Simple schema validation
    const errors: string[] = [];
    
    for (const [key, type] of Object.entries(schema)) {
      if (!(key in received)) {
        errors.push(`Missing required field: ${key}`);
      } else if (typeof received[key] !== type) {
        errors.push(`Field ${key} should be ${type}, got ${typeof received[key]}`);
      }
    }
    
    return {
      message: () =>
        errors.length === 0
          ? `expected object not to match schema`
          : `Schema validation failed:\n${errors.join('\n')}`,
      pass: errors.length === 0,
    };
  }
};

/**
 * Test Data Builders
 */
export class TestDataBuilder {
  static buildUser(overrides: any = {}) {
    return {
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      password: 'Test123!@#',
      ...overrides
    };
  }
  
  static buildScenario(overrides: any = {}) {
    return {
      title: 'Test Scenario',
      description: 'Test description',
      data: {
        purchasePrice: 500000,
        downPayment: 100000,
        interestRate: 5.5,
        loanTerm: 30,
        ...overrides.data
      },
      ...overrides
    };
  }
  
  static buildLoanData(overrides: any = {}) {
    return {
      loanAmount: 400000,
      interestRate: 5.5,
      termMonths: 360,
      propertyValue: 500000,
      monthlyIncome: 10000,
      monthlyDebt: 2000,
      ...overrides
    };
  }
}

/**
 * Mock Factories
 */
export class MockFactory {
  static createMockLogger() {
    return {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      child: jest.fn(() => MockFactory.createMockLogger())
    };
  }
  
  static createMockRequest(overrides: any = {}) {
    return {
      headers: {},
      params: {},
      query: {},
      body: {},
      user: null,
      ...overrides
    };
  }
  
  static createMockResponse() {
    const res: any = {
      status: jest.fn(() => res),
      send: jest.fn(() => res),
      json: jest.fn(() => res),
      header: jest.fn(() => res)
    };
    return res;
  }
}

/**
 * Assertion Helpers
 */
export class AssertionHelpers {
  static assertValidationError(result: any, expectedErrors: string[]) {
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(expectedErrors.length);
    expectedErrors.forEach(error => {
      expect(result.errors).toContain(error);
    });
  }
  
  static assertApiResponse(response: any, expectedStatus: number, expectedShape: any) {
    expect(response.statusCode).toBe(expectedStatus);
    expect(response.json()).toMatchObject(expectedShape);
  }
  
  static assertDatabaseQuery(db: any, expectedQuery: string, expectedParams: any[]) {
    expect(db.query).toHaveBeenCalledWith(expectedQuery, expectedParams);
  }
}
