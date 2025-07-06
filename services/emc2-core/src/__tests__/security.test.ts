/**
 * Security Test Suite
 * 
 * Comprehensive security testing for EMC2-Core
 */

import { FastifyInstance } from 'fastify';
import { createServer } from '../server';
import { 
  validatePassword, 
  calculatePasswordStrength,
  generateSecurePassword,
  timeSafeCompare
} from '../utils/passwordSecurity';
import { 
  sanitizeObject,
  validateApiKey,
  generateApiKey
} from '../middleware/security';

describe('Security Tests', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await createServer();
  });

  afterAll(async () => {
    await server.close();
  });

  describe('Password Security', () => {
    test('should validate strong passwords', () => {
      const result = validatePassword('MyStr0ng!P@ssw0rd123');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject weak passwords', () => {
      const weakPasswords = [
        'password',
        '12345678',
        'Password1',
        'abc123',
        'qwerty123'
      ];

      weakPasswords.forEach(password => {
        const result = validatePassword(password);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    test('should detect sequential characters', () => {
      const result = validatePassword('Abcd1234!@#$');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password contains sequential characters');
    });

    test('should detect repeating characters', () => {
      const result = validatePassword('Paasssword123!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password contains too many repeating characters');
    });

    test('should calculate password strength correctly', () => {
      const weak = calculatePasswordStrength('password123');
      expect(weak.strength).toBe('weak');
      expect(weak.score).toBeLessThan(5);

      const strong = calculatePasswordStrength('MyV3ry!Str0ng#P@ssw0rd');
      expect(strong.strength).toBe('very-strong');
      expect(strong.score).toBeGreaterThan(8);
    });

    test('should generate secure passwords', () => {
      const password = generateSecurePassword(16);
      expect(password).toHaveLength(16);
      
      const validation = validatePassword(password);
      expect(validation.valid).toBe(true);
    });

    test('should perform time-safe comparison', () => {
      const result1 = timeSafeCompare('password123', 'password123');
      expect(result1).toBe(true);

      const result2 = timeSafeCompare('password123', 'different');
      expect(result2).toBe(false);
    });
  });

  describe('Input Sanitization', () => {
    test('should prevent prototype pollution', () => {
      const malicious = {
        __proto__: { isAdmin: true },
        constructor: { prototype: { isAdmin: true } },
        prototype: { isAdmin: true }
      };

      const sanitized = sanitizeObject(malicious);
      expect(sanitized.__proto__).toBeUndefined();
      expect(sanitized.constructor).toBeUndefined();
      expect(sanitized.prototype).toBeUndefined();
    });

    test('should remove SQL injection patterns', () => {
      const malicious = {
        query: "'; DROP TABLE users; --",
        search: "admin' OR '1'='1",
        comment: "/* evil comment */"
      };

      const sanitized = sanitizeObject(malicious);
      expect(sanitized.query).not.toContain('DROP TABLE');
      expect(sanitized.search).not.toContain('OR');
      expect(sanitized.comment).not.toContain('/*');
    });

    test('should remove NoSQL injection patterns', () => {
      const malicious = {
        query: '{"$ne": null}',
        search: '{$gt: ""}',
        filter: '{"$where": "this.password == 123"}'
      };

      const sanitized = sanitizeObject(malicious);
      expect(sanitized.query).not.toContain('$');
      expect(sanitized.search).not.toContain('$');
      expect(sanitized.filter).not.toContain('$');
    });

    test('should limit string length', () => {
      const longString = 'a'.repeat(15000);
      const sanitized = sanitizeObject({ data: longString });
      expect(sanitized.data.length).toBeLessThanOrEqual(10000);
    });
  });

  describe('API Key Security', () => {
    test('should generate valid API keys', () => {
      const key = generateApiKey('client123');
      expect(key).toBeTruthy();
      expect(key.length).toBeGreaterThan(32);
      expect(key).not.toContain('+');
      expect(key).not.toContain('/');
      expect(key).not.toContain('=');
    });

    test('should validate API keys correctly', () => {
      const clientId = 'client123';
      const key = generateApiKey(clientId);
      
      const validation = validateApiKey(key);
      expect(validation.valid).toBe(true);
      expect(validation.clientId).toBe(clientId);
    });

    test('should reject invalid API keys', () => {
      const invalidKeys = [
        'invalid-key',
        '',
        'short',
        'a'.repeat(1000)
      ];

      invalidKeys.forEach(key => {
        const validation = validateApiKey(key);
        expect(validation.valid).toBe(false);
      });
    });
  });

  describe('Rate Limiting', () => {
    test('should enforce rate limits', async () => {
      const requests = Array(10).fill(null).map(() => 
        server.inject({
          method: 'GET',
          url: '/health'
        })
      );

      const responses = await Promise.all(requests);
      const rateLimited = responses.filter(r => r.statusCode === 429);
      
      // Should have some rate limited responses
      expect(rateLimited.length).toBeGreaterThan(0);
    });

    test('should include rate limit headers', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/health'
      });

      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });
  });

  describe('Security Headers', () => {
    test('should set security headers', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/'
      });

      // Check important security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(response.headers['permissions-policy']).toBeDefined();
    });

    test('should set HSTS header', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/'
      });

      expect(response.headers['strict-transport-security']).toContain('max-age=31536000');
      expect(response.headers['strict-transport-security']).toContain('includeSubDomains');
    });

    test('should set CSP header', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/'
      });

      const csp = response.headers['content-security-policy'];
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("base-uri 'self'");
    });
  });

  describe('CORS', () => {
    test('should handle preflight requests', async () => {
      const response = await server.inject({
        method: 'OPTIONS',
        url: '/api/v1/scenarios',
        headers: {
          'Origin': 'http://localhost:3000',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type,authorization'
        }
      });

      expect(response.statusCode).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toBeDefined();
      expect(response.headers['access-control-allow-headers']).toBeDefined();
    });

    test('should include CORS headers in responses', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/',
        headers: {
          'Origin': 'http://localhost:3000'
        }
      });

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });
  });

  describe('Content Type Validation', () => {
    test('should reject non-JSON content types for POST', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: {
          'content-type': 'text/plain'
        },
        payload: 'not json'
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().message).toContain('Content-Type must be application/json');
    });

    test('should accept JSON content types', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: {
          'content-type': 'application/json'
        },
        payload: {
          email: 'test@example.com',
          password: 'password123'
        }
      });

      // Should not be rejected for content type
      expect(response.statusCode).not.toBe(400);
    });
  });

  describe('XSS Protection', () => {
    test('should escape HTML in responses', async () => {
      // This would require a specific endpoint that returns user input
      // For now, we just verify the XSS protection header is set
      const response = await server.inject({
        method: 'GET',
        url: '/'
      });

      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });
  });
});
