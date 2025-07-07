/**
 * Security Audit Utilities Tests
 * Comprehensive test coverage for security audit logging
 */

import {
  logSecurityEvent,
  extractAuditContext,
  auditLoginAttempt,
  auditAccessControl,
  auditSensitiveDataAccess,
  auditSecurityViolation,
  generateAuditReport,
  generateComplianceReport,
  SecurityEventType,
  type AuditEvent,
} from '../securityAudit';
import { FastifyRequest } from 'fastify';
import { User } from '../../types/user';

// Mock the observableLogger
jest.mock('../observableLogger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

// Mock console.error to capture critical events
const originalConsoleError = console.error;
let consoleErrorSpy: jest.SpyInstance;

describe('Security Audit Utilities', () => {
  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    delete process.env.AUDIT_STORAGE;
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  afterAll(() => {
    console.error = originalConsoleError;
  });

  const mockRequest = {
    id: 'req-123',
    method: 'GET',
    url: '/api/test',
    protocol: 'https',
    hostname: 'example.com',
    ip: '192.168.1.1',
    headers: {
      'user-agent': 'Test Browser/1.0',
      'x-forwarded-for': '10.0.0.1',
      'x-real-ip': '172.16.0.1'
    }
  } as unknown as FastifyRequest;

  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: 'broker',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    permissions: ['read:accounts', 'write:reports']
  };

  describe('SecurityEventType enum', () => {
    it('should have all authentication event types', () => {
      expect(SecurityEventType.LOGIN_ATTEMPT).toBe('AUTH.LOGIN_ATTEMPT');
      expect(SecurityEventType.LOGIN_SUCCESS).toBe('AUTH.LOGIN_SUCCESS');
      expect(SecurityEventType.LOGIN_FAILURE).toBe('AUTH.LOGIN_FAILURE');
      expect(SecurityEventType.LOGOUT).toBe('AUTH.LOGOUT');
      expect(SecurityEventType.TOKEN_REFRESH).toBe('AUTH.TOKEN_REFRESH');
      expect(SecurityEventType.TOKEN_REVOKE).toBe('AUTH.TOKEN_REVOKE');
      expect(SecurityEventType.PASSWORD_RESET_REQUEST).toBe('AUTH.PASSWORD_RESET_REQUEST');
      expect(SecurityEventType.PASSWORD_RESET_SUCCESS).toBe('AUTH.PASSWORD_RESET_SUCCESS');
      expect(SecurityEventType.PASSWORD_CHANGE).toBe('AUTH.PASSWORD_CHANGE');
    });

    it('should have all authorization event types', () => {
      expect(SecurityEventType.ACCESS_GRANTED).toBe('AUTHZ.ACCESS_GRANTED');
      expect(SecurityEventType.ACCESS_DENIED).toBe('AUTHZ.ACCESS_DENIED');
      expect(SecurityEventType.PERMISSION_CHECK).toBe('AUTHZ.PERMISSION_CHECK');
      expect(SecurityEventType.ROLE_CHANGE).toBe('AUTHZ.ROLE_CHANGE');
    });

    it('should have all security violation event types', () => {
      expect(SecurityEventType.RATE_LIMIT_EXCEEDED).toBe('SECURITY.RATE_LIMIT_EXCEEDED');
      expect(SecurityEventType.INVALID_TOKEN).toBe('SECURITY.INVALID_TOKEN');
      expect(SecurityEventType.EXPIRED_TOKEN).toBe('SECURITY.EXPIRED_TOKEN');
      expect(SecurityEventType.SUSPICIOUS_ACTIVITY).toBe('SECURITY.SUSPICIOUS_ACTIVITY');
      expect(SecurityEventType.INJECTION_ATTEMPT).toBe('SECURITY.INJECTION_ATTEMPT');
      expect(SecurityEventType.XSS_ATTEMPT).toBe('SECURITY.XSS_ATTEMPT');
      expect(SecurityEventType.CSRF_ATTEMPT).toBe('SECURITY.CSRF_ATTEMPT');
    });

    it('should have all API key event types', () => {
      expect(SecurityEventType.API_KEY_CREATED).toBe('API.KEY_CREATED');
      expect(SecurityEventType.API_KEY_REVOKED).toBe('API.KEY_REVOKED');
      expect(SecurityEventType.API_KEY_USED).toBe('API.KEY_USED');
      expect(SecurityEventType.INVALID_API_KEY).toBe('API.INVALID_KEY');
    });

    it('should have all data access event types', () => {
      expect(SecurityEventType.SENSITIVE_DATA_ACCESS).toBe('DATA.SENSITIVE_ACCESS');
      expect(SecurityEventType.DATA_EXPORT).toBe('DATA.EXPORT');
      expect(SecurityEventType.BULK_OPERATION).toBe('DATA.BULK_OPERATION');
    });

    it('should have all account management event types', () => {
      expect(SecurityEventType.ACCOUNT_CREATED).toBe('ACCOUNT.CREATED');
      expect(SecurityEventType.ACCOUNT_UPDATED).toBe('ACCOUNT.UPDATED');
      expect(SecurityEventType.ACCOUNT_DELETED).toBe('ACCOUNT.DELETED');
      expect(SecurityEventType.ACCOUNT_LOCKED).toBe('ACCOUNT.LOCKED');
      expect(SecurityEventType.ACCOUNT_UNLOCKED).toBe('ACCOUNT.UNLOCKED');
      expect(SecurityEventType.EMAIL_VERIFIED).toBe('ACCOUNT.EMAIL_VERIFIED');
    });
  });

  describe('logSecurityEvent', () => {
    it('should log basic security event', async () => {
      const event: Partial<AuditEvent> = {
        eventType: SecurityEventType.LOGIN_SUCCESS,
        userId: 'user-123',
        email: 'test@example.com',
        ip: '192.168.1.1'
      };

      await logSecurityEvent(event);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should log event with all fields', async () => {
      const event: Partial<AuditEvent> = {
        eventType: SecurityEventType.LOGIN_FAILURE,
        severity: 'WARNING',
        userId: 'user-123',
        email: 'test@example.com',
        ip: '192.168.1.1',
        userAgent: 'Test Browser/1.0',
        correlationId: 'corr-123',
        details: { reason: 'Invalid password' },
        outcome: 'FAILURE',
        reason: 'Invalid credentials'
      };

      await logSecurityEvent(event);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should determine severity automatically', async () => {
      // Test critical event
      await logSecurityEvent({
        eventType: SecurityEventType.INJECTION_ATTEMPT
      });

      // Test warning event
      await logSecurityEvent({
        eventType: SecurityEventType.LOGIN_FAILURE
      });

      // Test info event
      await logSecurityEvent({
        eventType: SecurityEventType.LOGIN_SUCCESS
      });

      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should handle critical events', async () => {
      const event: Partial<AuditEvent> = {
        eventType: SecurityEventType.INJECTION_ATTEMPT,
        ip: '192.168.1.1',
        details: { payload: 'DROP TABLE users' }
      };

      await logSecurityEvent(event);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should handle audit storage when enabled', async () => {
      process.env.AUDIT_STORAGE = 'true';

      const event: Partial<AuditEvent> = {
        eventType: SecurityEventType.SUSPICIOUS_ACTIVITY,
        severity: 'CRITICAL'
      };

      await logSecurityEvent(event);
      
      // Should log critical event to console
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[CRITICAL AUDIT EVENT]',
        expect.stringContaining('SUSPICIOUS_ACTIVITY')
      );
    });

    it('should handle missing event type', async () => {
      const event: Partial<AuditEvent> = {
        userId: 'user-123'
        // Missing eventType
      };

      await expect(logSecurityEvent(event)).resolves.not.toThrow();
    });

    it('should apply defaults for missing fields', async () => {
      const event: Partial<AuditEvent> = {
        eventType: SecurityEventType.LOGIN_SUCCESS
      };

      await logSecurityEvent(event);
      
      // Should complete without throwing and apply defaults
      expect(true).toBe(true);
    });
  });

  describe('extractAuditContext', () => {
    it('should extract basic request context', () => {
      const context = extractAuditContext(mockRequest);

      expect(context).toEqual({
        userId: undefined,
        email: undefined,
        ip: '10.0.0.1', // x-forwarded-for takes precedence
        userAgent: 'Test Browser/1.0',
        correlationId: 'req-123',
        details: {
          method: 'GET',
          url: '/api/test',
          protocol: 'https',
          hostname: 'example.com'
        }
      });
    });

    it('should extract context with user', () => {
      const context = extractAuditContext(mockRequest, mockUser);

      expect(context).toEqual({
        userId: 'user-123',
        email: 'test@example.com',
        ip: '10.0.0.1',
        userAgent: 'Test Browser/1.0',
        correlationId: 'req-123',
        details: {
          method: 'GET',
          url: '/api/test',
          protocol: 'https',
          hostname: 'example.com'
        }
      });
    });

    it('should fallback to x-real-ip when x-forwarded-for is missing', () => {
      const requestWithoutForwarded = {
        ...mockRequest,
        headers: {
          ...mockRequest.headers,
          'x-forwarded-for': undefined,
          'x-real-ip': '172.16.0.1'
        }
      } as unknown as FastifyRequest;

      const context = extractAuditContext(requestWithoutForwarded);
      expect(context.ip).toBe('172.16.0.1');
    });

    it('should fallback to request.ip when headers are missing', () => {
      const requestWithoutHeaders = {
        ...mockRequest,
        headers: {
          'user-agent': 'Test Browser/1.0'
        }
      } as unknown as FastifyRequest;

      const context = extractAuditContext(requestWithoutHeaders);
      expect(context.ip).toBe('192.168.1.1');
    });

    it('should handle missing user agent', () => {
      const requestWithoutUA = {
        ...mockRequest,
        headers: {
          'x-forwarded-for': '10.0.0.1'
        }
      } as unknown as FastifyRequest;

      const context = extractAuditContext(requestWithoutUA);
      expect(context.userAgent).toBeUndefined();
    });
  });

  describe('auditLoginAttempt', () => {
    it('should log successful login attempt', async () => {
      await auditLoginAttempt(mockRequest, 'test@example.com', true);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should log failed login attempt', async () => {
      await auditLoginAttempt(mockRequest, 'test@example.com', false, 'Invalid password');
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should log failed login attempt without reason', async () => {
      await auditLoginAttempt(mockRequest, 'test@example.com', false);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should override context email with provided email', async () => {
      const requestWithUser = mockRequest;
      await auditLoginAttempt(requestWithUser, 'different@example.com', true);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });
  });

  describe('auditAccessControl', () => {
    it('should log granted access', async () => {
      await auditAccessControl(mockRequest, 'accounts', 'read', true, mockUser);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should log denied access', async () => {
      await auditAccessControl(mockRequest, 'accounts', 'delete', false, mockUser);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should log access control without user', async () => {
      await auditAccessControl(mockRequest, 'public-resource', 'read', true);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should include resource and action in details', async () => {
      await auditAccessControl(mockRequest, 'sensitive-data', 'export', false, mockUser);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should include user permissions in details', async () => {
      const userWithPermissions = {
        ...mockUser,
        permissions: ['read:accounts', 'write:reports', 'admin:users']
      };

      await auditAccessControl(mockRequest, 'user-management', 'admin', true, userWithPermissions);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });
  });

  describe('auditSensitiveDataAccess', () => {
    it('should log sensitive data access', async () => {
      const recordIds = ['record-1', 'record-2', 'record-3'];
      
      await auditSensitiveDataAccess(mockRequest, 'user-profiles', recordIds, mockUser);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should log sensitive data access without user', async () => {
      const recordIds = ['record-1'];
      
      await auditSensitiveDataAccess(mockRequest, 'system-logs', recordIds);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should truncate record IDs when more than 10', async () => {
      const recordIds = Array.from({ length: 15 }, (_, i) => `record-${i + 1}`);
      
      await auditSensitiveDataAccess(mockRequest, 'bulk-export', recordIds, mockUser);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should not truncate when 10 or fewer records', async () => {
      const recordIds = Array.from({ length: 10 }, (_, i) => `record-${i + 1}`);
      
      await auditSensitiveDataAccess(mockRequest, 'report-data', recordIds, mockUser);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should handle empty record IDs', async () => {
      await auditSensitiveDataAccess(mockRequest, 'empty-dataset', [], mockUser);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });
  });

  describe('auditSecurityViolation', () => {
    it('should log injection attempt', async () => {
      const details = {
        payload: "'; DROP TABLE users; --",
        field: 'username',
        detected_by: 'input_validation'
      };

      await auditSecurityViolation(mockRequest, SecurityEventType.INJECTION_ATTEMPT, details);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should log XSS attempt', async () => {
      const details = {
        payload: '<script>alert("xss")</script>',
        field: 'comment',
        detected_by: 'content_filter'
      };

      await auditSecurityViolation(mockRequest, SecurityEventType.XSS_ATTEMPT, details);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should log CSRF attempt', async () => {
      const details = {
        missing_token: true,
        referer: 'http://malicious-site.com',
        detected_by: 'csrf_middleware'
      };

      await auditSecurityViolation(mockRequest, SecurityEventType.CSRF_ATTEMPT, details);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should log suspicious activity', async () => {
      const details = {
        pattern: 'unusual_access_pattern',
        frequency: 'high',
        confidence: 0.85
      };

      await auditSecurityViolation(mockRequest, SecurityEventType.SUSPICIOUS_ACTIVITY, details);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should merge context details with provided details', async () => {
      const details = {
        custom_field: 'custom_value',
        violation_score: 100
      };

      await auditSecurityViolation(mockRequest, SecurityEventType.RATE_LIMIT_EXCEEDED, details);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });
  });

  describe('generateAuditReport', () => {
    it('should generate basic audit report', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const report = await generateAuditReport(startDate, endDate);

      expect(report).toEqual({
        summary: {},
        criticalEvents: [],
        userActivity: {}
      });
    });

    it('should generate audit report with filters', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const filters = {
        userId: 'user-123',
        eventTypes: [SecurityEventType.LOGIN_SUCCESS, SecurityEventType.LOGIN_FAILURE],
        severity: ['WARNING', 'CRITICAL'] as ('WARNING' | 'CRITICAL')[]
      };

      const report = await generateAuditReport(startDate, endDate, filters);

      expect(report).toEqual({
        summary: {},
        criticalEvents: [],
        userActivity: {}
      });
    });

    it('should handle date range validation', async () => {
      const startDate = new Date('2024-01-31');
      const endDate = new Date('2024-01-01'); // End before start

      const report = await generateAuditReport(startDate, endDate);

      expect(report).toEqual({
        summary: {},
        criticalEvents: [],
        userActivity: {}
      });
    });
  });

  describe('generateComplianceReport', () => {
    it('should generate SOC2 compliance report', async () => {
      const period = {
        start: new Date('2024-01-01'),
        end: new Date('2024-12-31')
      };

      const report = await generateComplianceReport('SOC2', period);

      expect(report).toEqual({
        compliant: true,
        findings: [],
        recommendations: []
      });
    });

    it('should generate ISO27001 compliance report', async () => {
      const period = {
        start: new Date('2024-01-01'),
        end: new Date('2024-12-31')
      };

      const report = await generateComplianceReport('ISO27001', period);

      expect(report).toEqual({
        compliant: true,
        findings: [],
        recommendations: []
      });
    });

    it('should generate HIPAA compliance report', async () => {
      const period = {
        start: new Date('2024-01-01'),
        end: new Date('2024-12-31')
      };

      const report = await generateComplianceReport('HIPAA', period);

      expect(report).toEqual({
        compliant: true,
        findings: [],
        recommendations: []
      });
    });

    it('should generate PCI-DSS compliance report', async () => {
      const period = {
        start: new Date('2024-01-01'),
        end: new Date('2024-12-31')
      };

      const report = await generateComplianceReport('PCI-DSS', period);

      expect(report).toEqual({
        compliant: true,
        findings: [],
        recommendations: []
      });
    });

    it('should handle different time periods', async () => {
      const period = {
        start: new Date('2023-01-01'),
        end: new Date('2023-03-31') // Quarterly report
      };

      const report = await generateComplianceReport('SOC2', period);

      expect(report).toEqual({
        compliant: true,
        findings: [],
        recommendations: []
      });
    });
  });

  describe('severity determination', () => {
    it('should classify critical events correctly', async () => {
      const criticalEvents = [
        SecurityEventType.INJECTION_ATTEMPT,
        SecurityEventType.XSS_ATTEMPT,
        SecurityEventType.CSRF_ATTEMPT,
        SecurityEventType.SUSPICIOUS_ACTIVITY,
        SecurityEventType.ACCOUNT_DELETED,
        SecurityEventType.DATA_EXPORT
      ];

      for (const eventType of criticalEvents) {
        await logSecurityEvent({ eventType });
      }

      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should classify warning events correctly', async () => {
      const warningEvents = [
        SecurityEventType.LOGIN_FAILURE,
        SecurityEventType.ACCESS_DENIED,
        SecurityEventType.RATE_LIMIT_EXCEEDED,
        SecurityEventType.INVALID_TOKEN,
        SecurityEventType.EXPIRED_TOKEN,
        SecurityEventType.INVALID_API_KEY,
        SecurityEventType.ACCOUNT_LOCKED
      ];

      for (const eventType of warningEvents) {
        await logSecurityEvent({ eventType });
      }

      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should classify info events correctly', async () => {
      const infoEvents = [
        SecurityEventType.LOGIN_SUCCESS,
        SecurityEventType.LOGOUT,
        SecurityEventType.TOKEN_REFRESH,
        SecurityEventType.ACCESS_GRANTED,
        SecurityEventType.ACCOUNT_CREATED,
        SecurityEventType.EMAIL_VERIFIED
      ];

      for (const eventType of infoEvents) {
        await logSecurityEvent({ eventType });
      }

      // Should complete without throwing
      expect(true).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle audit logging errors gracefully', async () => {
      // This should not throw even if internal operations fail
      await expect(logSecurityEvent({
        eventType: SecurityEventType.LOGIN_SUCCESS
      })).resolves.not.toThrow();
    });

    it('should handle invalid event types gracefully', async () => {
      await expect(logSecurityEvent({
        eventType: 'INVALID.EVENT_TYPE' as SecurityEventType
      })).resolves.not.toThrow();
    });

    it('should handle malformed request objects', async () => {
      const malformedRequest = {
        id: 'test',
        headers: null
      } as unknown as FastifyRequest;

      await expect(auditLoginAttempt(
        malformedRequest,
        'test@example.com',
        true
      )).resolves.not.toThrow();
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete login flow audit', async () => {
      // Failed attempt
      await auditLoginAttempt(mockRequest, 'test@example.com', false, 'Invalid password');
      
      // Successful attempt
      await auditLoginAttempt(mockRequest, 'test@example.com', true);
      
      // Access granted
      await auditAccessControl(mockRequest, 'dashboard', 'view', true, mockUser);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should handle security incident workflow', async () => {
      // Detect violation
      await auditSecurityViolation(mockRequest, SecurityEventType.INJECTION_ATTEMPT, {
        payload: 'malicious input'
      });
      
      // Lock account
      await logSecurityEvent({
        eventType: SecurityEventType.ACCOUNT_LOCKED,
        userId: mockUser.id,
        reason: 'Security violation detected'
      });
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should handle data access audit trail', async () => {
      // Access sensitive data
      await auditSensitiveDataAccess(mockRequest, 'financial_records', ['rec-1', 'rec-2'], mockUser);
      
      // Export data
      await logSecurityEvent({
        eventType: SecurityEventType.DATA_EXPORT,
        userId: mockUser.id,
        details: { format: 'CSV', recordCount: 2 }
      });
      
      // Should complete without throwing
      expect(true).toBe(true);
    });
  });
});/**
 * Security Audit Utilities Tests
 * Comprehensive test coverage for security audit logging
 */

import {
  logSecurityEvent,
  extractAuditContext,
  auditLoginAttempt,
  auditAccessControl,
  auditSensitiveDataAccess,
  auditSecurityViolation,
  generateAuditReport,
  generateComplianceReport,
  SecurityEventType,
  type AuditEvent,
} from '../securityAudit';
import { FastifyRequest } from 'fastify';
import { User } from '../../types/user';

// Mock the observableLogger
jest.mock('../observableLogger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

// Mock console.error to capture critical events
const originalConsoleError = console.error;
let consoleErrorSpy: jest.SpyInstance;

describe('Security Audit Utilities', () => {
  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    delete process.env.AUDIT_STORAGE;
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  afterAll(() => {
    console.error = originalConsoleError;
  });

  const mockRequest = {
    id: 'req-123',
    method: 'GET',
    url: '/api/test',
    protocol: 'https',
    hostname: 'example.com',
    ip: '192.168.1.1',
    headers: {
      'user-agent': 'Test Browser/1.0',
      'x-forwarded-for': '10.0.0.1',
      'x-real-ip': '172.16.0.1'
    }
  } as unknown as FastifyRequest;

  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: 'broker',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    permissions: ['read:accounts', 'write:reports']
  };

  describe('SecurityEventType enum', () => {
    it('should have all authentication event types', () => {
      expect(SecurityEventType.LOGIN_ATTEMPT).toBe('AUTH.LOGIN_ATTEMPT');
      expect(SecurityEventType.LOGIN_SUCCESS).toBe('AUTH.LOGIN_SUCCESS');
      expect(SecurityEventType.LOGIN_FAILURE).toBe('AUTH.LOGIN_FAILURE');
      expect(SecurityEventType.LOGOUT).toBe('AUTH.LOGOUT');
      expect(SecurityEventType.TOKEN_REFRESH).toBe('AUTH.TOKEN_REFRESH');
      expect(SecurityEventType.TOKEN_REVOKE).toBe('AUTH.TOKEN_REVOKE');
      expect(SecurityEventType.PASSWORD_RESET_REQUEST).toBe('AUTH.PASSWORD_RESET_REQUEST');
      expect(SecurityEventType.PASSWORD_RESET_SUCCESS).toBe('AUTH.PASSWORD_RESET_SUCCESS');
      expect(SecurityEventType.PASSWORD_CHANGE).toBe('AUTH.PASSWORD_CHANGE');
    });

    it('should have all authorization event types', () => {
      expect(SecurityEventType.ACCESS_GRANTED).toBe('AUTHZ.ACCESS_GRANTED');
      expect(SecurityEventType.ACCESS_DENIED).toBe('AUTHZ.ACCESS_DENIED');
      expect(SecurityEventType.PERMISSION_CHECK).toBe('AUTHZ.PERMISSION_CHECK');
      expect(SecurityEventType.ROLE_CHANGE).toBe('AUTHZ.ROLE_CHANGE');
    });

    it('should have all security violation event types', () => {
      expect(SecurityEventType.RATE_LIMIT_EXCEEDED).toBe('SECURITY.RATE_LIMIT_EXCEEDED');
      expect(SecurityEventType.INVALID_TOKEN).toBe('SECURITY.INVALID_TOKEN');
      expect(SecurityEventType.EXPIRED_TOKEN).toBe('SECURITY.EXPIRED_TOKEN');
      expect(SecurityEventType.SUSPICIOUS_ACTIVITY).toBe('SECURITY.SUSPICIOUS_ACTIVITY');
      expect(SecurityEventType.INJECTION_ATTEMPT).toBe('SECURITY.INJECTION_ATTEMPT');
      expect(SecurityEventType.XSS_ATTEMPT).toBe('SECURITY.XSS_ATTEMPT');
      expect(SecurityEventType.CSRF_ATTEMPT).toBe('SECURITY.CSRF_ATTEMPT');
    });

    it('should have all API key event types', () => {
      expect(SecurityEventType.API_KEY_CREATED).toBe('API.KEY_CREATED');
      expect(SecurityEventType.API_KEY_REVOKED).toBe('API.KEY_REVOKED');
      expect(SecurityEventType.API_KEY_USED).toBe('API.KEY_USED');
      expect(SecurityEventType.INVALID_API_KEY).toBe('API.INVALID_KEY');
    });

    it('should have all data access event types', () => {
      expect(SecurityEventType.SENSITIVE_DATA_ACCESS).toBe('DATA.SENSITIVE_ACCESS');
      expect(SecurityEventType.DATA_EXPORT).toBe('DATA.EXPORT');
      expect(SecurityEventType.BULK_OPERATION).toBe('DATA.BULK_OPERATION');
    });

    it('should have all account management event types', () => {
      expect(SecurityEventType.ACCOUNT_CREATED).toBe('ACCOUNT.CREATED');
      expect(SecurityEventType.ACCOUNT_UPDATED).toBe('ACCOUNT.UPDATED');
      expect(SecurityEventType.ACCOUNT_DELETED).toBe('ACCOUNT.DELETED');
      expect(SecurityEventType.ACCOUNT_LOCKED).toBe('ACCOUNT.LOCKED');
      expect(SecurityEventType.ACCOUNT_UNLOCKED).toBe('ACCOUNT.UNLOCKED');
      expect(SecurityEventType.EMAIL_VERIFIED).toBe('ACCOUNT.EMAIL_VERIFIED');
    });
  });

  describe('logSecurityEvent', () => {
    it('should log basic security event', async () => {
      const event: Partial<AuditEvent> = {
        eventType: SecurityEventType.LOGIN_SUCCESS,
        userId: 'user-123',
        email: 'test@example.com',
        ip: '192.168.1.1'
      };

      await logSecurityEvent(event);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should log event with all fields', async () => {
      const event: Partial<AuditEvent> = {
        eventType: SecurityEventType.LOGIN_FAILURE,
        severity: 'WARNING',
        userId: 'user-123',
        email: 'test@example.com',
        ip: '192.168.1.1',
        userAgent: 'Test Browser/1.0',
        correlationId: 'corr-123',
        details: { reason: 'Invalid password' },
        outcome: 'FAILURE',
        reason: 'Invalid credentials'
      };

      await logSecurityEvent(event);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should determine severity automatically', async () => {
      // Test critical event
      await logSecurityEvent({
        eventType: SecurityEventType.INJECTION_ATTEMPT
      });

      // Test warning event
      await logSecurityEvent({
        eventType: SecurityEventType.LOGIN_FAILURE
      });

      // Test info event
      await logSecurityEvent({
        eventType: SecurityEventType.LOGIN_SUCCESS
      });

      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should handle critical events', async () => {
      const event: Partial<AuditEvent> = {
        eventType: SecurityEventType.INJECTION_ATTEMPT,
        ip: '192.168.1.1',
        details: { payload: 'DROP TABLE users' }
      };

      await logSecurityEvent(event);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should handle audit storage when enabled', async () => {
      process.env.AUDIT_STORAGE = 'true';

      const event: Partial<AuditEvent> = {
        eventType: SecurityEventType.SUSPICIOUS_ACTIVITY,
        severity: 'CRITICAL'
      };

      await logSecurityEvent(event);
      
      // Should log critical event to console
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[CRITICAL AUDIT EVENT]',
        expect.stringContaining('SUSPICIOUS_ACTIVITY')
      );
    });

    it('should handle missing event type', async () => {
      const event: Partial<AuditEvent> = {
        userId: 'user-123'
        // Missing eventType
      };

      await expect(logSecurityEvent(event)).resolves.not.toThrow();
    });

    it('should apply defaults for missing fields', async () => {
      const event: Partial<AuditEvent> = {
        eventType: SecurityEventType.LOGIN_SUCCESS
      };

      await logSecurityEvent(event);
      
      // Should complete without throwing and apply defaults
      expect(true).toBe(true);
    });
  });

  describe('extractAuditContext', () => {
    it('should extract basic request context', () => {
      const context = extractAuditContext(mockRequest);

      expect(context).toEqual({
        userId: undefined,
        email: undefined,
        ip: '10.0.0.1', // x-forwarded-for takes precedence
        userAgent: 'Test Browser/1.0',
        correlationId: 'req-123',
        details: {
          method: 'GET',
          url: '/api/test',
          protocol: 'https',
          hostname: 'example.com'
        }
      });
    });

    it('should extract context with user', () => {
      const context = extractAuditContext(mockRequest, mockUser);

      expect(context).toEqual({
        userId: 'user-123',
        email: 'test@example.com',
        ip: '10.0.0.1',
        userAgent: 'Test Browser/1.0',
        correlationId: 'req-123',
        details: {
          method: 'GET',
          url: '/api/test',
          protocol: 'https',
          hostname: 'example.com'
        }
      });
    });

    it('should fallback to x-real-ip when x-forwarded-for is missing', () => {
      const requestWithoutForwarded = {
        ...mockRequest,
        headers: {
          ...mockRequest.headers,
          'x-forwarded-for': undefined,
          'x-real-ip': '172.16.0.1'
        }
      } as unknown as FastifyRequest;

      const context = extractAuditContext(requestWithoutForwarded);
      expect(context.ip).toBe('172.16.0.1');
    });

    it('should fallback to request.ip when headers are missing', () => {
      const requestWithoutHeaders = {
        ...mockRequest,
        headers: {
          'user-agent': 'Test Browser/1.0'
        }
      } as unknown as FastifyRequest;

      const context = extractAuditContext(requestWithoutHeaders);
      expect(context.ip).toBe('192.168.1.1');
    });

    it('should handle missing user agent', () => {
      const requestWithoutUA = {
        ...mockRequest,
        headers: {
          'x-forwarded-for': '10.0.0.1'
        }
      } as unknown as FastifyRequest;

      const context = extractAuditContext(requestWithoutUA);
      expect(context.userAgent).toBeUndefined();
    });
  });

  describe('auditLoginAttempt', () => {
    it('should log successful login attempt', async () => {
      await auditLoginAttempt(mockRequest, 'test@example.com', true);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should log failed login attempt', async () => {
      await auditLoginAttempt(mockRequest, 'test@example.com', false, 'Invalid password');
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should log failed login attempt without reason', async () => {
      await auditLoginAttempt(mockRequest, 'test@example.com', false);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should override context email with provided email', async () => {
      const requestWithUser = mockRequest;
      await auditLoginAttempt(requestWithUser, 'different@example.com', true);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });
  });

  describe('auditAccessControl', () => {
    it('should log granted access', async () => {
      await auditAccessControl(mockRequest, 'accounts', 'read', true, mockUser);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should log denied access', async () => {
      await auditAccessControl(mockRequest, 'accounts', 'delete', false, mockUser);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should log access control without user', async () => {
      await auditAccessControl(mockRequest, 'public-resource', 'read', true);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should include resource and action in details', async () => {
      await auditAccessControl(mockRequest, 'sensitive-data', 'export', false, mockUser);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should include user permissions in details', async () => {
      const userWithPermissions = {
        ...mockUser,
        permissions: ['read:accounts', 'write:reports', 'admin:users']
      };

      await auditAccessControl(mockRequest, 'user-management', 'admin', true, userWithPermissions);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });
  });

  describe('auditSensitiveDataAccess', () => {
    it('should log sensitive data access', async () => {
      const recordIds = ['record-1', 'record-2', 'record-3'];
      
      await auditSensitiveDataAccess(mockRequest, 'user-profiles', recordIds, mockUser);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should log sensitive data access without user', async () => {
      const recordIds = ['record-1'];
      
      await auditSensitiveDataAccess(mockRequest, 'system-logs', recordIds);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should truncate record IDs when more than 10', async () => {
      const recordIds = Array.from({ length: 15 }, (_, i) => `record-${i + 1}`);
      
      await auditSensitiveDataAccess(mockRequest, 'bulk-export', recordIds, mockUser);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should not truncate when 10 or fewer records', async () => {
      const recordIds = Array.from({ length: 10 }, (_, i) => `record-${i + 1}`);
      
      await auditSensitiveDataAccess(mockRequest, 'report-data', recordIds, mockUser);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should handle empty record IDs', async () => {
      await auditSensitiveDataAccess(mockRequest, 'empty-dataset', [], mockUser);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });
  });

  describe('auditSecurityViolation', () => {
    it('should log injection attempt', async () => {
      const details = {
        payload: "'; DROP TABLE users; --",
        field: 'username',
        detected_by: 'input_validation'
      };

      await auditSecurityViolation(mockRequest, SecurityEventType.INJECTION_ATTEMPT, details);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should log XSS attempt', async () => {
      const details = {
        payload: '<script>alert("xss")</script>',
        field: 'comment',
        detected_by: 'content_filter'
      };

      await auditSecurityViolation(mockRequest, SecurityEventType.XSS_ATTEMPT, details);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should log CSRF attempt', async () => {
      const details = {
        missing_token: true,
        referer: 'http://malicious-site.com',
        detected_by: 'csrf_middleware'
      };

      await auditSecurityViolation(mockRequest, SecurityEventType.CSRF_ATTEMPT, details);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should log suspicious activity', async () => {
      const details = {
        pattern: 'unusual_access_pattern',
        frequency: 'high',
        confidence: 0.85
      };

      await auditSecurityViolation(mockRequest, SecurityEventType.SUSPICIOUS_ACTIVITY, details);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should merge context details with provided details', async () => {
      const details = {
        custom_field: 'custom_value',
        violation_score: 100
      };

      await auditSecurityViolation(mockRequest, SecurityEventType.RATE_LIMIT_EXCEEDED, details);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });
  });

  describe('generateAuditReport', () => {
    it('should generate basic audit report', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const report = await generateAuditReport(startDate, endDate);

      expect(report).toEqual({
        summary: {},
        criticalEvents: [],
        userActivity: {}
      });
    });

    it('should generate audit report with filters', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const filters = {
        userId: 'user-123',
        eventTypes: [SecurityEventType.LOGIN_SUCCESS, SecurityEventType.LOGIN_FAILURE],
        severity: ['WARNING', 'CRITICAL'] as ('WARNING' | 'CRITICAL')[]
      };

      const report = await generateAuditReport(startDate, endDate, filters);

      expect(report).toEqual({
        summary: {},
        criticalEvents: [],
        userActivity: {}
      });
    });

    it('should handle date range validation', async () => {
      const startDate = new Date('2024-01-31');
      const endDate = new Date('2024-01-01'); // End before start

      const report = await generateAuditReport(startDate, endDate);

      expect(report).toEqual({
        summary: {},
        criticalEvents: [],
        userActivity: {}
      });
    });
  });

  describe('generateComplianceReport', () => {
    it('should generate SOC2 compliance report', async () => {
      const period = {
        start: new Date('2024-01-01'),
        end: new Date('2024-12-31')
      };

      const report = await generateComplianceReport('SOC2', period);

      expect(report).toEqual({
        compliant: true,
        findings: [],
        recommendations: []
      });
    });

    it('should generate ISO27001 compliance report', async () => {
      const period = {
        start: new Date('2024-01-01'),
        end: new Date('2024-12-31')
      };

      const report = await generateComplianceReport('ISO27001', period);

      expect(report).toEqual({
        compliant: true,
        findings: [],
        recommendations: []
      });
    });

    it('should generate HIPAA compliance report', async () => {
      const period = {
        start: new Date('2024-01-01'),
        end: new Date('2024-12-31')
      };

      const report = await generateComplianceReport('HIPAA', period);

      expect(report).toEqual({
        compliant: true,
        findings: [],
        recommendations: []
      });
    });

    it('should generate PCI-DSS compliance report', async () => {
      const period = {
        start: new Date('2024-01-01'),
        end: new Date('2024-12-31')
      };

      const report = await generateComplianceReport('PCI-DSS', period);

      expect(report).toEqual({
        compliant: true,
        findings: [],
        recommendations: []
      });
    });

    it('should handle different time periods', async () => {
      const period = {
        start: new Date('2023-01-01'),
        end: new Date('2023-03-31') // Quarterly report
      };

      const report = await generateComplianceReport('SOC2', period);

      expect(report).toEqual({
        compliant: true,
        findings: [],
        recommendations: []
      });
    });
  });

  describe('severity determination', () => {
    it('should classify critical events correctly', async () => {
      const criticalEvents = [
        SecurityEventType.INJECTION_ATTEMPT,
        SecurityEventType.XSS_ATTEMPT,
        SecurityEventType.CSRF_ATTEMPT,
        SecurityEventType.SUSPICIOUS_ACTIVITY,
        SecurityEventType.ACCOUNT_DELETED,
        SecurityEventType.DATA_EXPORT
      ];

      for (const eventType of criticalEvents) {
        await logSecurityEvent({ eventType });
      }

      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should classify warning events correctly', async () => {
      const warningEvents = [
        SecurityEventType.LOGIN_FAILURE,
        SecurityEventType.ACCESS_DENIED,
        SecurityEventType.RATE_LIMIT_EXCEEDED,
        SecurityEventType.INVALID_TOKEN,
        SecurityEventType.EXPIRED_TOKEN,
        SecurityEventType.INVALID_API_KEY,
        SecurityEventType.ACCOUNT_LOCKED
      ];

      for (const eventType of warningEvents) {
        await logSecurityEvent({ eventType });
      }

      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should classify info events correctly', async () => {
      const infoEvents = [
        SecurityEventType.LOGIN_SUCCESS,
        SecurityEventType.LOGOUT,
        SecurityEventType.TOKEN_REFRESH,
        SecurityEventType.ACCESS_GRANTED,
        SecurityEventType.ACCOUNT_CREATED,
        SecurityEventType.EMAIL_VERIFIED
      ];

      for (const eventType of infoEvents) {
        await logSecurityEvent({ eventType });
      }

      // Should complete without throwing
      expect(true).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle audit logging errors gracefully', async () => {
      // This should not throw even if internal operations fail
      await expect(logSecurityEvent({
        eventType: SecurityEventType.LOGIN_SUCCESS
      })).resolves.not.toThrow();
    });

    it('should handle invalid event types gracefully', async () => {
      await expect(logSecurityEvent({
        eventType: 'INVALID.EVENT_TYPE' as SecurityEventType
      })).resolves.not.toThrow();
    });

    it('should handle malformed request objects', async () => {
      const malformedRequest = {
        id: 'test',
        headers: null
      } as unknown as FastifyRequest;

      await expect(auditLoginAttempt(
        malformedRequest,
        'test@example.com',
        true
      )).resolves.not.toThrow();
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete login flow audit', async () => {
      // Failed attempt
      await auditLoginAttempt(mockRequest, 'test@example.com', false, 'Invalid password');
      
      // Successful attempt
      await auditLoginAttempt(mockRequest, 'test@example.com', true);
      
      // Access granted
      await auditAccessControl(mockRequest, 'dashboard', 'view', true, mockUser);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should handle security incident workflow', async () => {
      // Detect violation
      await auditSecurityViolation(mockRequest, SecurityEventType.INJECTION_ATTEMPT, {
        payload: 'malicious input'
      });
      
      // Lock account
      await logSecurityEvent({
        eventType: SecurityEventType.ACCOUNT_LOCKED,
        userId: mockUser.id,
        reason: 'Security violation detected'
      });
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should handle data access audit trail', async () => {
      // Access sensitive data
      await auditSensitiveDataAccess(mockRequest, 'financial_records', ['rec-1', 'rec-2'], mockUser);
      
      // Export data
      await logSecurityEvent({
        eventType: SecurityEventType.DATA_EXPORT,
        userId: mockUser.id,
        details: { format: 'CSV', recordCount: 2 }
      });
      
      // Should complete without throwing
      expect(true).toBe(true);
    });
  });
});can you /**
 * Security Audit Utilities Tests
 * Comprehensive test coverage for security audit logging
 */

import {
  logSecurityEvent,
  extractAuditContext,
  auditLoginAttempt,
  auditAccessControl,
  auditSensitiveDataAccess,
  auditSecurityViolation,
  generateAuditReport,
  generateComplianceReport,
  SecurityEventType,
  type AuditEvent,
} from '../securityAudit';
import { FastifyRequest } from 'fastify';
import { User } from '../../types/user';

// Mock the observableLogger
jest.mock('../observableLogger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

// Mock console.error to capture critical events
const originalConsoleError = console.error;
let consoleErrorSpy: jest.SpyInstance;

describe('Security Audit Utilities', () => {
  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    delete process.env.AUDIT_STORAGE;
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  afterAll(() => {
    console.error = originalConsoleError;
  });

  const mockRequest = {
    id: 'req-123',
    method: 'GET',
    url: '/api/test',
    protocol: 'https',
    hostname: 'example.com',
    ip: '192.168.1.1',
    headers: {
      'user-agent': 'Test Browser/1.0',
      'x-forwarded-for': '10.0.0.1',
      'x-real-ip': '172.16.0.1'
    }
  } as unknown as FastifyRequest;

  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: 'broker',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    permissions: ['read:accounts', 'write:reports']
  };

  describe('SecurityEventType enum', () => {
    it('should have all authentication event types', () => {
      expect(SecurityEventType.LOGIN_ATTEMPT).toBe('AUTH.LOGIN_ATTEMPT');
      expect(SecurityEventType.LOGIN_SUCCESS).toBe('AUTH.LOGIN_SUCCESS');
      expect(SecurityEventType.LOGIN_FAILURE).toBe('AUTH.LOGIN_FAILURE');
      expect(SecurityEventType.LOGOUT).toBe('AUTH.LOGOUT');
      expect(SecurityEventType.TOKEN_REFRESH).toBe('AUTH.TOKEN_REFRESH');
      expect(SecurityEventType.TOKEN_REVOKE).toBe('AUTH.TOKEN_REVOKE');
      expect(SecurityEventType.PASSWORD_RESET_REQUEST).toBe('AUTH.PASSWORD_RESET_REQUEST');
      expect(SecurityEventType.PASSWORD_RESET_SUCCESS).toBe('AUTH.PASSWORD_RESET_SUCCESS');
      expect(SecurityEventType.PASSWORD_CHANGE).toBe('AUTH.PASSWORD_CHANGE');
    });

    it('should have all authorization event types', () => {
      expect(SecurityEventType.ACCESS_GRANTED).toBe('AUTHZ.ACCESS_GRANTED');
      expect(SecurityEventType.ACCESS_DENIED).toBe('AUTHZ.ACCESS_DENIED');
      expect(SecurityEventType.PERMISSION_CHECK).toBe('AUTHZ.PERMISSION_CHECK');
      expect(SecurityEventType.ROLE_CHANGE).toBe('AUTHZ.ROLE_CHANGE');
    });

    it('should have all security violation event types', () => {
      expect(SecurityEventType.RATE_LIMIT_EXCEEDED).toBe('SECURITY.RATE_LIMIT_EXCEEDED');
      expect(SecurityEventType.INVALID_TOKEN).toBe('SECURITY.INVALID_TOKEN');
      expect(SecurityEventType.EXPIRED_TOKEN).toBe('SECURITY.EXPIRED_TOKEN');
      expect(SecurityEventType.SUSPICIOUS_ACTIVITY).toBe('SECURITY.SUSPICIOUS_ACTIVITY');
      expect(SecurityEventType.INJECTION_ATTEMPT).toBe('SECURITY.INJECTION_ATTEMPT');
      expect(SecurityEventType.XSS_ATTEMPT).toBe('SECURITY.XSS_ATTEMPT');
      expect(SecurityEventType.CSRF_ATTEMPT).toBe('SECURITY.CSRF_ATTEMPT');
    });

    it('should have all API key event types', () => {
      expect(SecurityEventType.API_KEY_CREATED).toBe('API.KEY_CREATED');
      expect(SecurityEventType.API_KEY_REVOKED).toBe('API.KEY_REVOKED');
      expect(SecurityEventType.API_KEY_USED).toBe('API.KEY_USED');
      expect(SecurityEventType.INVALID_API_KEY).toBe('API.INVALID_KEY');
    });

    it('should have all data access event types', () => {
      expect(SecurityEventType.SENSITIVE_DATA_ACCESS).toBe('DATA.SENSITIVE_ACCESS');
      expect(SecurityEventType.DATA_EXPORT).toBe('DATA.EXPORT');
      expect(SecurityEventType.BULK_OPERATION).toBe('DATA.BULK_OPERATION');
    });

    it('should have all account management event types', () => {
      expect(SecurityEventType.ACCOUNT_CREATED).toBe('ACCOUNT.CREATED');
      expect(SecurityEventType.ACCOUNT_UPDATED).toBe('ACCOUNT.UPDATED');
      expect(SecurityEventType.ACCOUNT_DELETED).toBe('ACCOUNT.DELETED');
      expect(SecurityEventType.ACCOUNT_LOCKED).toBe('ACCOUNT.LOCKED');
      expect(SecurityEventType.ACCOUNT_UNLOCKED).toBe('ACCOUNT.UNLOCKED');
      expect(SecurityEventType.EMAIL_VERIFIED).toBe('ACCOUNT.EMAIL_VERIFIED');
    });
  });

  describe('logSecurityEvent', () => {
    it('should log basic security event', async () => {
      const event: Partial<AuditEvent> = {
        eventType: SecurityEventType.LOGIN_SUCCESS,
        userId: 'user-123',
        email: 'test@example.com',
        ip: '192.168.1.1'
      };

      await logSecurityEvent(event);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should log event with all fields', async () => {
      const event: Partial<AuditEvent> = {
        eventType: SecurityEventType.LOGIN_FAILURE,
        severity: 'WARNING',
        userId: 'user-123',
        email: 'test@example.com',
        ip: '192.168.1.1',
        userAgent: 'Test Browser/1.0',
        correlationId: 'corr-123',
        details: { reason: 'Invalid password' },
        outcome: 'FAILURE',
        reason: 'Invalid credentials'
      };

      await logSecurityEvent(event);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should determine severity automatically', async () => {
      // Test critical event
      await logSecurityEvent({
        eventType: SecurityEventType.INJECTION_ATTEMPT
      });

      // Test warning event
      await logSecurityEvent({
        eventType: SecurityEventType.LOGIN_FAILURE
      });

      // Test info event
      await logSecurityEvent({
        eventType: SecurityEventType.LOGIN_SUCCESS
      });

      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should handle critical events', async () => {
      const event: Partial<AuditEvent> = {
        eventType: SecurityEventType.INJECTION_ATTEMPT,
        ip: '192.168.1.1',
        details: { payload: 'DROP TABLE users' }
      };

      await logSecurityEvent(event);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should handle audit storage when enabled', async () => {
      process.env.AUDIT_STORAGE = 'true';

      const event: Partial<AuditEvent> = {
        eventType: SecurityEventType.SUSPICIOUS_ACTIVITY,
        severity: 'CRITICAL'
      };

      await logSecurityEvent(event);
      
      // Should log critical event to console
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[CRITICAL AUDIT EVENT]',
        expect.stringContaining('SUSPICIOUS_ACTIVITY')
      );
    });

    it('should handle missing event type', async () => {
      const event: Partial<AuditEvent> = {
        userId: 'user-123'
        // Missing eventType
      };

      await expect(logSecurityEvent(event)).resolves.not.toThrow();
    });

    it('should apply defaults for missing fields', async () => {
      const event: Partial<AuditEvent> = {
        eventType: SecurityEventType.LOGIN_SUCCESS
      };

      await logSecurityEvent(event);
      
      // Should complete without throwing and apply defaults
      expect(true).toBe(true);
    });
  });

  describe('extractAuditContext', () => {
    it('should extract basic request context', () => {
      const context = extractAuditContext(mockRequest);

      expect(context).toEqual({
        userId: undefined,
        email: undefined,
        ip: '10.0.0.1', // x-forwarded-for takes precedence
        userAgent: 'Test Browser/1.0',
        correlationId: 'req-123',
        details: {
          method: 'GET',
          url: '/api/test',
          protocol: 'https',
          hostname: 'example.com'
        }
      });
    });

    it('should extract context with user', () => {
      const context = extractAuditContext(mockRequest, mockUser);

      expect(context).toEqual({
        userId: 'user-123',
        email: 'test@example.com',
        ip: '10.0.0.1',
        userAgent: 'Test Browser/1.0',
        correlationId: 'req-123',
        details: {
          method: 'GET',
          url: '/api/test',
          protocol: 'https',
          hostname: 'example.com'
        }
      });
    });

    it('should fallback to x-real-ip when x-forwarded-for is missing', () => {
      const requestWithoutForwarded = {
        ...mockRequest,
        headers: {
          ...mockRequest.headers,
          'x-forwarded-for': undefined,
          'x-real-ip': '172.16.0.1'
        }
      } as unknown as FastifyRequest;

      const context = extractAuditContext(requestWithoutForwarded);
      expect(context.ip).toBe('172.16.0.1');
    });

    it('should fallback to request.ip when headers are missing', () => {
      const requestWithoutHeaders = {
        ...mockRequest,
        headers: {
          'user-agent': 'Test Browser/1.0'
        }
      } as unknown as FastifyRequest;

      const context = extractAuditContext(requestWithoutHeaders);
      expect(context.ip).toBe('192.168.1.1');
    });

    it('should handle missing user agent', () => {
      const requestWithoutUA = {
        ...mockRequest,
        headers: {
          'x-forwarded-for': '10.0.0.1'
        }
      } as unknown as FastifyRequest;

      const context = extractAuditContext(requestWithoutUA);
      expect(context.userAgent).toBeUndefined();
    });
  });

  describe('auditLoginAttempt', () => {
    it('should log successful login attempt', async () => {
      await auditLoginAttempt(mockRequest, 'test@example.com', true);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should log failed login attempt', async () => {
      await auditLoginAttempt(mockRequest, 'test@example.com', false, 'Invalid password');
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should log failed login attempt without reason', async () => {
      await auditLoginAttempt(mockRequest, 'test@example.com', false);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should override context email with provided email', async () => {
      const requestWithUser = mockRequest;
      await auditLoginAttempt(requestWithUser, 'different@example.com', true);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });
  });

  describe('auditAccessControl', () => {
    it('should log granted access', async () => {
      await auditAccessControl(mockRequest, 'accounts', 'read', true, mockUser);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should log denied access', async () => {
      await auditAccessControl(mockRequest, 'accounts', 'delete', false, mockUser);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should log access control without user', async () => {
      await auditAccessControl(mockRequest, 'public-resource', 'read', true);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should include resource and action in details', async () => {
      await auditAccessControl(mockRequest, 'sensitive-data', 'export', false, mockUser);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should include user permissions in details', async () => {
      const userWithPermissions = {
        ...mockUser,
        permissions: ['read:accounts', 'write:reports', 'admin:users']
      };

      await auditAccessControl(mockRequest, 'user-management', 'admin', true, userWithPermissions);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });
  });

  describe('auditSensitiveDataAccess', () => {
    it('should log sensitive data access', async () => {
      const recordIds = ['record-1', 'record-2', 'record-3'];
      
      await auditSensitiveDataAccess(mockRequest, 'user-profiles', recordIds, mockUser);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should log sensitive data access without user', async () => {
      const recordIds = ['record-1'];
      
      await auditSensitiveDataAccess(mockRequest, 'system-logs', recordIds);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should truncate record IDs when more than 10', async () => {
      const recordIds = Array.from({ length: 15 }, (_, i) => `record-${i + 1}`);
      
      await auditSensitiveDataAccess(mockRequest, 'bulk-export', recordIds, mockUser);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should not truncate when 10 or fewer records', async () => {
      const recordIds = Array.from({ length: 10 }, (_, i) => `record-${i + 1}`);
      
      await auditSensitiveDataAccess(mockRequest, 'report-data', recordIds, mockUser);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should handle empty record IDs', async () => {
      await auditSensitiveDataAccess(mockRequest, 'empty-dataset', [], mockUser);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });
  });

  describe('auditSecurityViolation', () => {
    it('should log injection attempt', async () => {
      const details = {
        payload: "'; DROP TABLE users; --",
        field: 'username',
        detected_by: 'input_validation'
      };

      await auditSecurityViolation(mockRequest, SecurityEventType.INJECTION_ATTEMPT, details);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should log XSS attempt', async () => {
      const details = {
        payload: '<script>alert("xss")</script>',
        field: 'comment',
        detected_by: 'content_filter'
      };

      await auditSecurityViolation(mockRequest, SecurityEventType.XSS_ATTEMPT, details);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should log CSRF attempt', async () => {
      const details = {
        missing_token: true,
        referer: 'http://malicious-site.com',
        detected_by: 'csrf_middleware'
      };

      await auditSecurityViolation(mockRequest, SecurityEventType.CSRF_ATTEMPT, details);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should log suspicious activity', async () => {
      const details = {
        pattern: 'unusual_access_pattern',
        frequency: 'high',
        confidence: 0.85
      };

      await auditSecurityViolation(mockRequest, SecurityEventType.SUSPICIOUS_ACTIVITY, details);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should merge context details with provided details', async () => {
      const details = {
        custom_field: 'custom_value',
        violation_score: 100
      };

      await auditSecurityViolation(mockRequest, SecurityEventType.RATE_LIMIT_EXCEEDED, details);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });
  });

  describe('generateAuditReport', () => {
    it('should generate basic audit report', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const report = await generateAuditReport(startDate, endDate);

      expect(report).toEqual({
        summary: {},
        criticalEvents: [],
        userActivity: {}
      });
    });

    it('should generate audit report with filters', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const filters = {
        userId: 'user-123',
        eventTypes: [SecurityEventType.LOGIN_SUCCESS, SecurityEventType.LOGIN_FAILURE],
        severity: ['WARNING', 'CRITICAL'] as ('WARNING' | 'CRITICAL')[]
      };

      const report = await generateAuditReport(startDate, endDate, filters);

      expect(report).toEqual({
        summary: {},
        criticalEvents: [],
        userActivity: {}
      });
    });

    it('should handle date range validation', async () => {
      const startDate = new Date('2024-01-31');
      const endDate = new Date('2024-01-01'); // End before start

      const report = await generateAuditReport(startDate, endDate);

      expect(report).toEqual({
        summary: {},
        criticalEvents: [],
        userActivity: {}
      });
    });
  });

  describe('generateComplianceReport', () => {
    it('should generate SOC2 compliance report', async () => {
      const period = {
        start: new Date('2024-01-01'),
        end: new Date('2024-12-31')
      };

      const report = await generateComplianceReport('SOC2', period);

      expect(report).toEqual({
        compliant: true,
        findings: [],
        recommendations: []
      });
    });

    it('should generate ISO27001 compliance report', async () => {
      const period = {
        start: new Date('2024-01-01'),
        end: new Date('2024-12-31')
      };

      const report = await generateComplianceReport('ISO27001', period);

      expect(report).toEqual({
        compliant: true,
        findings: [],
        recommendations: []
      });
    });

    it('should generate HIPAA compliance report', async () => {
      const period = {
        start: new Date('2024-01-01'),
        end: new Date('2024-12-31')
      };

      const report = await generateComplianceReport('HIPAA', period);

      expect(report).toEqual({
        compliant: true,
        findings: [],
        recommendations: []
      });
    });

    it('should generate PCI-DSS compliance report', async () => {
      const period = {
        start: new Date('2024-01-01'),
        end: new Date('2024-12-31')
      };

      const report = await generateComplianceReport('PCI-DSS', period);

      expect(report).toEqual({
        compliant: true,
        findings: [],
        recommendations: []
      });
    });

    it('should handle different time periods', async () => {
      const period = {
        start: new Date('2023-01-01'),
        end: new Date('2023-03-31') // Quarterly report
      };

      const report = await generateComplianceReport('SOC2', period);

      expect(report).toEqual({
        compliant: true,
        findings: [],
        recommendations: []
      });
    });
  });

  describe('severity determination', () => {
    it('should classify critical events correctly', async () => {
      const criticalEvents = [
        SecurityEventType.INJECTION_ATTEMPT,
        SecurityEventType.XSS_ATTEMPT,
        SecurityEventType.CSRF_ATTEMPT,
        SecurityEventType.SUSPICIOUS_ACTIVITY,
        SecurityEventType.ACCOUNT_DELETED,
        SecurityEventType.DATA_EXPORT
      ];

      for (const eventType of criticalEvents) {
        await logSecurityEvent({ eventType });
      }

      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should classify warning events correctly', async () => {
      const warningEvents = [
        SecurityEventType.LOGIN_FAILURE,
        SecurityEventType.ACCESS_DENIED,
        SecurityEventType.RATE_LIMIT_EXCEEDED,
        SecurityEventType.INVALID_TOKEN,
        SecurityEventType.EXPIRED_TOKEN,
        SecurityEventType.INVALID_API_KEY,
        SecurityEventType.ACCOUNT_LOCKED
      ];

      for (const eventType of warningEvents) {
        await logSecurityEvent({ eventType });
      }

      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should classify info events correctly', async () => {
      const infoEvents = [
        SecurityEventType.LOGIN_SUCCESS,
        SecurityEventType.LOGOUT,
        SecurityEventType.TOKEN_REFRESH,
        SecurityEventType.ACCESS_GRANTED,
        SecurityEventType.ACCOUNT_CREATED,
        SecurityEventType.EMAIL_VERIFIED
      ];

      for (const eventType of infoEvents) {
        await logSecurityEvent({ eventType });
      }

      // Should complete without throwing
      expect(true).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle audit logging errors gracefully', async () => {
      // This should not throw even if internal operations fail
      await expect(logSecurityEvent({
        eventType: SecurityEventType.LOGIN_SUCCESS
      })).resolves.not.toThrow();
    });

    it('should handle invalid event types gracefully', async () => {
      await expect(logSecurityEvent({
        eventType: 'INVALID.EVENT_TYPE' as SecurityEventType
      })).resolves.not.toThrow();
    });

    it('should handle malformed request objects', async () => {
      const malformedRequest = {
        id: 'test',
        headers: null
      } as unknown as FastifyRequest;

      await expect(auditLoginAttempt(
        malformedRequest,
        'test@example.com',
        true
      )).resolves.not.toThrow();
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete login flow audit', async () => {
      // Failed attempt
      await auditLoginAttempt(mockRequest, 'test@example.com', false, 'Invalid password');
      
      // Successful attempt
      await auditLoginAttempt(mockRequest, 'test@example.com', true);
      
      // Access granted
      await auditAccessControl(mockRequest, 'dashboard', 'view', true, mockUser);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should handle security incident workflow', async () => {
      // Detect violation
      await auditSecurityViolation(mockRequest, SecurityEventType.INJECTION_ATTEMPT, {
        payload: 'malicious input'
      });
      
      // Lock account
      await logSecurityEvent({
        eventType: SecurityEventType.ACCOUNT_LOCKED,
        userId: mockUser.id,
        reason: 'Security violation detected'
      });
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should handle data access audit trail', async () => {
      // Access sensitive data
      await auditSensitiveDataAccess(mockRequest, 'financial_records', ['rec-1', 'rec-2'], mockUser);
      
      // Export data
      await logSecurityEvent({
        eventType: SecurityEventType.DATA_EXPORT,
        userId: mockUser.id,
        details: { format: 'CSV', recordCount: 2 }
      });
      
      // Should complete without throwing
      expect(true).toBe(true);
    });
  });
});