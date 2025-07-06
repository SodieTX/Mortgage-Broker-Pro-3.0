/**
 * Integration Tests for Service Interactions
 * 
 * Tests the interaction between services with real dependencies
 */

import { createServer } from '../../server';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { ServiceInitializer } from '../../services/serviceInitializer';

describe('Service Integration Tests', () => {
  let app: any; // Using any to avoid type conflicts
  let db: Pool;
  let redis: Redis;
  
  // Test data
  const testUser = {
    email: 'integration-test@example.com',
    firstName: 'Integration',
    lastName: 'Test',
    password: 'Test123!@#'
  };

  beforeAll(async () => {
    // Initialize services
    await ServiceInitializer.initialize();
    
    // Create test database connection
    db = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/mortgage_broker_test'
    });
    
    // Create test Redis connection
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: 1 // Use different DB for tests
    });
    
    // Clear test data
    await db.query('TRUNCATE auth.users CASCADE');
    await redis.flushdb();
    
    // Create server
    app = await createServer();
    await app.ready();
  }, 30000);

  afterAll(async () => {
    await app.close();
    await db.end();
    await redis.quit();
  });

  describe('Health Checks', () => {
    test('Basic health check should return ok', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health/v2'
      });
      
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        status: 'ok',
        environment: expect.any(String),
        version: expect.any(String),
        uptime: expect.any(Number)
      });
    });

    test('Full health check should include all components', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health/v2/full'
      });
      
      expect(response.statusCode).toBe(200);
      const health = response.json();
      
      expect(health).toMatchObject({
        status: expect.stringMatching(/healthy|degraded|unhealthy/),
        checks: expect.objectContaining({
          database: expect.any(Object),
          memory: expect.any(Object),
          disk: expect.any(Object),
          email: expect.any(Object)
        })
      });
      
      // Verify correlation ID is included
      expect(health.correlationId).toBeDefined();
    });

    test('Component health check should work', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health/v2/check/database'
      });
      
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        component: 'database',
        status: expect.stringMatching(/up|down|degraded/),
        latency: expect.any(Number)
      });
    });
  });

  describe('Authentication Flow', () => {
    let accessToken: string;
    let refreshToken: string;
    let sessionId: string;

    test('Should register a new user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: testUser
      });
      
      expect(response.statusCode).toBe(201);
      const result = response.json();
      
      expect(result).toMatchObject({
        user: {
          email: testUser.email,
          firstName: testUser.firstName,
          lastName: testUser.lastName
        },
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        sessionId: expect.any(String)
      });
      
      accessToken = result.accessToken;
      refreshToken = result.refreshToken;
      sessionId = result.sessionId;
    });

    test('Should login with credentials', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: testUser.email,
          password: testUser.password
        }
      });
      
      expect(response.statusCode).toBe(200);
      const result = response.json();
      
      expect(result).toMatchObject({
        user: expect.any(Object),
        accessToken: expect.any(String),
        refreshToken: expect.any(String)
      });
    });

    test('Should refresh token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: {
          refreshToken
        }
      });
      
      expect(response.statusCode).toBe(200);
      const result = response.json();
      
      expect(result).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String)
      });
      
      // New tokens should be different
      expect(result.accessToken).not.toBe(accessToken);
      expect(result.refreshToken).not.toBe(refreshToken);
    });

    test('Should logout successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/logout',
        headers: {
          authorization: `Bearer ${accessToken}`
        }
      });
      
      expect(response.statusCode).toBe(200);
      
      // Verify session is blacklisted
      const blacklisted = await redis.exists(`blacklist:${sessionId}`);
      expect(blacklisted).toBe(1);
    });
  });

  describe('Scenario Management', () => {
    let authToken: string;
    let scenarioId: string;

    beforeAll(async () => {
      // Create a user and get auth token
      const userResult = await db.query(
        `INSERT INTO auth.users (email, first_name, last_name, password_hash, role)
         VALUES ($1, $2, $3, $4, 'broker')
         RETURNING id`,
        ['scenario-test@example.com', 'Scenario', 'Test', 'hashed']
      );
      // userId = userResult.rows[0].id; // Not used
      
      // Create auth token (in real app, this would be via login)
      const authResponse = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: 'scenario-test2@example.com',
          firstName: 'Scenario',
          lastName: 'Test2',
          password: 'Test123!@#'
        }
      });
      authToken = authResponse.json().accessToken;
    });

    test('Should create a scenario', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/scenarios',
        headers: {
          authorization: `Bearer ${authToken}`
        },
        payload: {
          title: 'Integration Test Scenario',
          description: 'Testing scenario creation',
          data: {
            purchasePrice: 500000,
            downPayment: 100000,
            interestRate: 5.5,
            loanTerm: 30
          }
        }
      });
      
      expect(response.statusCode).toBe(201);
      const scenario = response.json();
      
      expect(scenario).toMatchObject({
        id: expect.any(String),
        title: 'Integration Test Scenario',
        userId: expect.any(String),
        createdAt: expect.any(String)
      });
      
      scenarioId = scenario.id;
    });

    test('Should calculate scenario metrics', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/scenarios/${scenarioId}/calculate`,
        headers: {
          authorization: `Bearer ${authToken}`
        }
      });
      
      expect(response.statusCode).toBe(200);
      const calculations = response.json();
      
      expect(calculations).toMatchObject({
        monthlyPayment: expect.any(Number),
        totalInterest: expect.any(Number),
        totalPayment: expect.any(Number),
        loanToValue: expect.any(Number),
        amortizationSchedule: expect.any(Array)
      });
    });
  });

  describe('Email Service Integration', () => {
    let authToken: string;
    
    beforeAll(async () => {
      // Get auth token
      const authResponse = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: 'email-test@example.com',
          firstName: 'Email',
          lastName: 'Test',
          password: 'Test123!@#'
        }
      });
      authToken = authResponse.json().accessToken;
    });
    
    test('Should send test email without error', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/email/test',
        headers: {
          authorization: `Bearer ${authToken}`
        },
        payload: {
          to: 'test@example.com'
        }
      });
      
      // Email service should handle gracefully even without SMTP
      expect(response.statusCode).toBe(200);
      const result = response.json();
      
      expect(result).toMatchObject({
        success: expect.any(Boolean),
        message: expect.any(String)
      });
    });

    test('Should track email metrics', async () => {
      // Get metrics
      const response = await app.inject({
        method: 'GET',
        url: '/metrics'
      });
      
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/plain');
      
      const metrics = response.payload;
      expect(metrics).toContain('# HELP');
      expect(metrics).toContain('# TYPE');
    });
  });

  describe('Observability Integration', () => {
    test('Should include correlation ID in all responses', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health/v2',
        headers: {
          'x-correlation-id': 'test-correlation-123'
        }
      });
      
      expect(response.headers['x-correlation-id']).toBe('test-correlation-123');
    });

    test('Should generate correlation ID if not provided', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health/v2'
      });
      
      expect(response.headers['x-correlation-id']).toBeDefined();
      expect(response.headers['x-correlation-id']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });

    test('Should record metrics for requests', async () => {
      // Make several requests
      await app.inject({ method: 'GET', url: '/health/v2' });
      await app.inject({ method: 'GET', url: '/health/v2' });
      await app.inject({ method: 'GET', url: '/health/v2/full' });
      
      // Get metrics
      const response = await app.inject({
        method: 'GET',
        url: '/metrics'
      });
      
      const metrics = response.payload;
      
      // Check for HTTP metrics
      expect(metrics).toContain('http_requests_total');
      expect(metrics).toContain('http_request_duration_seconds');
      expect(metrics).toContain('method="GET"');
      expect(metrics).toContain('route="/health/v2"');
    });
  });
});

describe('Error Handling Integration', () => {
  let app: any; // Using any to avoid type conflicts

  beforeAll(async () => {
    app = await createServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  test('Should handle 404 errors properly', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/non-existent-endpoint'
    });
    
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({
      statusCode: 404,
      error: 'Not Found',
      message: expect.any(String)
    });
  });

  test('Should handle malformed JSON', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: {
        'content-type': 'application/json'
      },
      payload: '{"invalid json}'
    });
    
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      statusCode: 400,
      error: 'Bad Request'
    });
  });

  test('Should handle validation errors', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: 'not-an-email',
        firstName: '',
        lastName: '',
        password: '123' // Too short
      }
    });
    
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      statusCode: 400,
      error: 'Bad Request',
      message: expect.stringContaining('validation')
    });
  });
});
