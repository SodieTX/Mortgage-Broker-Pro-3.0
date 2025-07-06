/**
 * World-Class Test Utilities
 * 
 * Enterprise-grade testing utilities incorporating best practices from
 * Google, Microsoft, Apple, and Oracle
 */

import { faker } from '@faker-js/faker';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';

/**
 * Test Data Builder Pattern (Google-inspired)
 * Fluent API for creating test data with sensible defaults
 */
export class TestDataBuilder<T> {
  private data: Partial<T> = {};
  
  with<K extends keyof T>(key: K, value: T[K]): this {
    this.data[key] = value;
    return this;
  }
  
  withMany(updates: Partial<T>): this {
    Object.assign(this.data, updates);
    return this;
  }
  
  build(): T {
    return this.data as T;
  }
  
  buildMany(count: number, modifier?: (data: T, index: number) => T): T[] {
    return Array.from({ length: count }, (_, i) => {
      const base = this.build();
      return modifier ? modifier(base, i) : base;
    });
  }
}

/**
 * Domain-specific test data factories
 */
export class TestDataFactory {
  static createUser(overrides: any = {}) {
    return new TestDataBuilder<any>()
      .with('id', uuidv4())
      .with('email', faker.internet.email())
      .with('firstName', faker.person.firstName())
      .with('lastName', faker.person.lastName())
      .with('phone', faker.phone.number())
      .with('role', 'broker')
      .with('isActive', true)
      .with('createdAt', new Date())
      .withMany(overrides)
      .build();
  }
  
  static createScenario(overrides: any = {}) {
    const purchasePrice = faker.number.int({ min: 200000, max: 2000000 });
    const downPayment = purchasePrice * faker.number.float({ min: 0.05, max: 0.30 });
    
    return new TestDataBuilder<any>()
      .with('id', uuidv4())
      .with('title', faker.company.catchPhrase())
      .with('status', faker.helpers.arrayElement(['Draft', 'Active', 'Completed']))
      .with('borrower', {
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        creditScore: faker.number.int({ min: 600, max: 850 }),
        annualIncome: faker.number.int({ min: 50000, max: 500000 }),
        monthlyDebt: faker.number.int({ min: 0, max: 5000 })
      })
      .with('property', {
        address: faker.location.streetAddress(),
        city: faker.location.city(),
        state: faker.location.state({ abbreviated: true }),
        zipCode: faker.location.zipCode(),
        purchasePrice,
        propertyType: faker.helpers.arrayElement(['SFR', 'Condo', 'Townhouse', 'Multi-Family'])
      })
      .with('loan', {
        loanAmount: purchasePrice - downPayment,
        downPayment,
        loanPurpose: faker.helpers.arrayElement(['Purchase', 'Refinance', 'Cash-Out']),
        loanType: faker.helpers.arrayElement(['Conventional', 'FHA', 'VA', 'Jumbo', 'DSCR']),
        termMonths: faker.helpers.arrayElement([360, 180])
      })
      .with('createdAt', faker.date.recent())
      .withMany(overrides)
      .build();
  }
  
  static createDSCRProperty(overrides: any = {}) {
    const monthlyRent = faker.number.int({ min: 1500, max: 10000 });
    
    return new TestDataBuilder<any>()
      .with('monthlyRent', monthlyRent)
      .with('vacancyRate', faker.number.float({ min: 0.03, max: 0.10 }))
      .with('propertyTaxes', faker.number.int({ min: 2000, max: 15000 }))
      .with('insurance', faker.number.int({ min: 1000, max: 5000 }))
      .with('hoaFees', faker.helpers.maybe(() => faker.number.int({ min: 50, max: 500 })))
      .with('utilities', faker.helpers.maybe(() => faker.number.int({ min: 50, max: 300 })))
      .with('maintenance', faker.number.int({ min: 100, max: 500 }))
      .with('managementRate', faker.number.float({ min: 0.06, max: 0.10 }))
      .withMany(overrides)
      .build();
  }
  
  static createLoanOffer(overrides: any = {}) {
    return new TestDataBuilder<any>()
      .with('id', uuidv4())
      .with('lender', faker.company.name())
      .with('rate', faker.number.float({ min: 5.0, max: 8.0, fractionDigits: 3 }))
      .with('points', faker.number.float({ min: 0, max: 3, fractionDigits: 2 }))
      .with('fees', faker.number.int({ min: 1000, max: 10000 }))
      .with('ltv', faker.number.int({ min: 60, max: 95 }))
      .with('dscr', faker.number.float({ min: 1.0, max: 2.0, fractionDigits: 2 }))
      .with('prepaymentPenalty', faker.helpers.arrayElement(['None', '3/2/1', '5/4/3/2/1']))
      .with('status', faker.helpers.arrayElement(['Pending', 'Approved', 'Expired']))
      .withMany(overrides)
      .build();
  }
}

/**
 * Test Database Manager (Oracle-inspired)
 * Handles test database lifecycle and data integrity
 */
export class TestDatabaseManager {
  private pool: Pool;
  private snapshots: Map<string, any> = new Map();
  
  constructor(pool: Pool) {
    this.pool = pool;
  }
  
  async createSnapshot(name: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const tables = await this.getTableNames();
      const snapshot: any = {};
      
      for (const table of tables) {
        const result = await client.query(`SELECT * FROM ${table}`);
        snapshot[table] = result.rows;
      }
      
      this.snapshots.set(name, snapshot);
      await client.query('COMMIT');
    } finally {
      client.release();
    }
  }
  
  async restoreSnapshot(name: string): Promise<void> {
    const snapshot = this.snapshots.get(name);
    if (!snapshot) throw new Error(`Snapshot ${name} not found`);
    
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      // Disable foreign key checks
      await client.query('SET CONSTRAINTS ALL DEFERRED');
      
      // Clear all tables
      const tables = await this.getTableNames();
      for (const table of tables.reverse()) {
        await client.query(`TRUNCATE TABLE ${table} CASCADE`);
      }
      
      // Restore data
      for (const [table, rows] of Object.entries(snapshot)) {
        const rowsArray = rows as any[];
        if (rowsArray.length > 0) {
          const columns = Object.keys(rowsArray[0]);
          const values = rowsArray.map((row: any) => 
            columns.map(col => row[col])
          );
          
          const placeholders = values.map((_: any, i: number) => 
            `(${columns.map((_: any, j: number) => `$${i * columns.length + j + 1}`).join(', ')})`
          ).join(', ');
          
          const query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${placeholders}`;
          await client.query(query, values.flat());
        }
      }
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  private async getTableNames(): Promise<string[]> {
    const result = await this.pool.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `);
    return result.rows.map(row => row.tablename);
  }
  
  async truncateAllTables(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET CONSTRAINTS ALL DEFERRED');
      const tables = await this.getTableNames();
      
      for (const table of tables.reverse()) {
        await client.query(`TRUNCATE TABLE ${table} CASCADE`);
      }
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

/**
 * Test Time Manager (Microsoft-inspired)
 * Controls time in tests for deterministic results
 */
export class TestTimeManager {
  private static instance: TestTimeManager;
  private frozenTime: Date | null = null;
  
  static getInstance(): TestTimeManager {
    if (!TestTimeManager.instance) {
      TestTimeManager.instance = new TestTimeManager();
    }
    return TestTimeManager.instance;
  }
  
  freeze(date?: Date): void {
    this.frozenTime = date || new Date();
    jest.useFakeTimers();
    jest.setSystemTime(this.frozenTime);
  }
  
  advance(ms: number): void {
    if (!this.frozenTime) throw new Error('Time not frozen');
    this.frozenTime = new Date(this.frozenTime.getTime() + ms);
    jest.setSystemTime(this.frozenTime);
  }
  
  unfreeze(): void {
    this.frozenTime = null;
    jest.useRealTimers();
  }
  
  getCurrentTime(): Date {
    return this.frozenTime || new Date();
  }
}

/**
 * API Test Client (Apple-inspired)
 * Simplified API testing with authentication
 */
export class APITestClient {
  private app: FastifyInstance;
  private authToken?: string;
  private defaultHeaders: Record<string, string> = {};
  
  constructor(app: FastifyInstance) {
    this.app = app;
  }
  
  async authenticate(credentials?: { email: string; password: string }): Promise<void> {
    const { email, password } = credentials || {
      email: 'test@example.com',
      password: 'Test123!@#'
    };
    
    const response = await this.post('/auth/login', { email, password });
    this.authToken = response.json().token;
    this.defaultHeaders['Authorization'] = `Bearer ${this.authToken}`;
  }
  
  setHeaders(headers: Record<string, string>): void {
    Object.assign(this.defaultHeaders, headers);
  }
  
  async get(url: string, headers?: Record<string, string>) {
    return this.app.inject({
      method: 'GET',
      url,
      headers: { ...this.defaultHeaders, ...headers }
    });
  }
  
  async post(url: string, payload?: any, headers?: Record<string, string>) {
    return this.app.inject({
      method: 'POST',
      url,
      payload,
      headers: { ...this.defaultHeaders, ...headers }
    });
  }
  
  async put(url: string, payload?: any, headers?: Record<string, string>) {
    return this.app.inject({
      method: 'PUT',
      url,
      payload,
      headers: { ...this.defaultHeaders, ...headers }
    });
  }
  
  async delete(url: string, headers?: Record<string, string>) {
    return this.app.inject({
      method: 'DELETE',
      url,
      headers: { ...this.defaultHeaders, ...headers }
    });
  }
}

/**
 * Test Assertions Library
 * Custom assertions for domain-specific validations
 */
export class TestAssertions {
  static assertValidDSCR(dscr: any): void {
    expect(dscr).toHaveProperty('dscr');
    expect(dscr.dscr).toBeGreaterThanOrEqual(0);
    expect(dscr).toHaveProperty('netOperatingIncome');
    expect(dscr).toHaveProperty('totalDebtService');
    expect(dscr).toHaveProperty('cashFlow');
    expect(dscr).toHaveProperty('loanApproved');
    expect(typeof dscr.loanApproved).toBe('boolean');
  }
  
  static assertValidLoanMetrics(metrics: any): void {
    expect(metrics).toHaveProperty('loanToValue');
    expect(metrics.loanToValue).toBeGreaterThanOrEqual(0);
    expect(metrics.loanToValue).toBeLessThanOrEqual(100);
    
    expect(metrics).toHaveProperty('debtToIncome');
    expect(metrics.debtToIncome).toBeGreaterThanOrEqual(0);
    
    expect(metrics).toHaveProperty('monthlyPayment');
    expect(metrics.monthlyPayment).toBeGreaterThan(0);
    
    expect(metrics).toHaveProperty('affordabilityScore');
    expect(metrics.affordabilityScore).toBeGreaterThanOrEqual(0);
    expect(metrics.affordabilityScore).toBeLessThanOrEqual(100);
  }
  
  static assertValidScenario(scenario: any): void {
    expect(scenario).toHaveProperty('id');
    expect(scenario).toHaveProperty('status');
    expect(['Draft', 'Active', 'Completed', 'Archived']).toContain(scenario.status);
    expect(scenario).toHaveProperty('borrower');
    expect(scenario).toHaveProperty('property');
    expect(scenario).toHaveProperty('loan');
  }
  
  static assertApiError(response: any, expectedStatus: number, expectedMessage?: string): void {
    expect(response.statusCode).toBe(expectedStatus);
    const body = response.json();
    expect(body).toHaveProperty('error');
    if (expectedMessage) {
      expect(body.error).toContain(expectedMessage);
    }
  }
  
  static assertApiSuccess(response: any, expectedStatus: number = 200): void {
    expect(response.statusCode).toBe(expectedStatus);
    const body = response.json();
    expect(body).toHaveProperty('success', true);
  }
}

/**
 * Performance Test Utilities
 * Measure and assert performance characteristics
 */
export class PerformanceTestUtils {
  static async measureExecutionTime<T>(
    fn: () => Promise<T>,
    maxDuration: number
  ): Promise<{ result: T; duration: number }> {
    const start = process.hrtime.bigint();
    const result = await fn();
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1_000_000; // Convert to ms
    
    expect(duration).toBeLessThan(maxDuration);
    return { result, duration };
  }
  
  static async measureMemoryUsage<T>(
    fn: () => Promise<T>
  ): Promise<{ result: T; memoryDelta: number }> {
    if (global.gc) global.gc();
    const before = process.memoryUsage().heapUsed;
    const result = await fn();
    if (global.gc) global.gc();
    const after = process.memoryUsage().heapUsed;
    const memoryDelta = after - before;
    
    return { result, memoryDelta };
  }
  
  static async runConcurrent<T>(
    fn: () => Promise<T>,
    concurrency: number
  ): Promise<T[]> {
    const promises = Array.from({ length: concurrency }, () => fn());
    return Promise.all(promises);
  }
}

/**
 * Test Redis Manager
 * Handles Redis lifecycle for tests
 */
export class TestRedisManager {
  private redis: Redis;
  private snapshots: Map<string, Record<string, string>> = new Map();
  
  constructor(redis: Redis) {
    this.redis = redis;
  }
  
  async createSnapshot(name: string): Promise<void> {
    const keys = await this.redis.keys('*');
    const snapshot: Record<string, string> = {};
    
    for (const key of keys) {
      const value = await this.redis.get(key);
      if (value) snapshot[key] = value;
    }
    
    this.snapshots.set(name, snapshot);
  }
  
  async restoreSnapshot(name: string): Promise<void> {
    const snapshot = this.snapshots.get(name);
    if (!snapshot) throw new Error(`Snapshot ${name} not found`);
    
    await this.redis.flushall();
    
    for (const [key, value] of Object.entries(snapshot)) {
      await this.redis.set(key, value);
    }
  }
  
  async clear(): Promise<void> {
    await this.redis.flushall();
  }
}

/**
 * Wait Utilities
 * Helpers for async testing scenarios
 */
export class WaitUtils {
  static async waitFor(
    condition: () => boolean | Promise<boolean>,
    timeout: number = 5000,
    interval: number = 100
  ): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await condition()) return;
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error(`Condition not met within ${timeout}ms`);
  }
  
  static async retry<T>(
    fn: () => Promise<T>,
    retries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error | undefined;
    
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError || new Error('Retry failed');
  }
}

// Classes are already exported above, no need to re-export
