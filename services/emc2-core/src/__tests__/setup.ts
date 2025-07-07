// Test setup for EMC² Core Service
import { jest } from '@jest/globals';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce noise during tests

// Mock logger to prevent console output during tests
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    fatal: jest.fn(),
    trace: jest.fn(),
    level: 'error',
    child: jest.fn(() => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      fatal: jest.fn(),
      trace: jest.fn(),
    })),
  },
}));

// Global test timeout
jest.setTimeout(10000);

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

// Mock database connection
jest.mock('../db/connection', () => ({
  getDatabase: jest.fn(() => Promise.resolve({
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 } as any),
    connect: jest.fn(),
    end: jest.fn(),
    release: jest.fn(),
  })),
  testConnection: jest.fn(() => Promise.resolve(true)),
}));

// Mock Redis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn().mockResolvedValue(null as any),
    set: jest.fn().mockResolvedValue('OK' as any),
    del: jest.fn().mockResolvedValue(1 as any),
    exists: jest.fn().mockResolvedValue(0 as any),
    expire: jest.fn().mockResolvedValue(1 as any),
    ping: jest.fn().mockResolvedValue('PONG' as any),
    quit: jest.fn().mockResolvedValue(undefined as any),
    connect: jest.fn().mockResolvedValue(undefined as any),
    disconnect: jest.fn().mockResolvedValue(undefined as any),
    flushdb: jest.fn().mockResolvedValue('OK' as any),
    on: jest.fn(),
    off: jest.fn(),
  }));
});

// Mock Bull queue
jest.mock('bull', () => {
  return jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue({} as any),
    process: jest.fn(),
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined as any),
  }));
});

// Global error handler for unhandled promises
process.on('unhandledRejection', (error) => {
  console.error('Unhandled Promise Rejection:', error);
});

// Add custom matchers
expect.extend({
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
});

// Extend Jest matchers TypeScript definitions
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidUUID(): R;
      toBeWithinRange(floor: number, ceiling: number): R;
    }
  }
}

// Dummy test to satisfy Jest requirement
describe('Test Setup', () => {
  it('should initialize test environment', () => {
    expect(process.env.NODE_ENV).toBe('test');
    expect(process.env.LOG_LEVEL).toBe('error');
  });
});

export {};
