/**
 * Security Audit Logging
 * 
 * Records all security-relevant events for compliance and forensics
 */

import { FastifyRequest } from 'fastify';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { createLogger } from './observableLogger';
import { User } from '../types/user';

const auditLogger = createLogger('security-audit');
const tracer = trace.getTracer('emc2-core');

export interface AuditEvent {
  timestamp: Date;
  eventType: SecurityEventType;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  userId?: string;
  email?: string;
  ip?: string;
  userAgent?: string;
  correlationId?: string;
  details: Record<string, any>;
  outcome: 'SUCCESS' | 'FAILURE';
  reason?: string;
}

export enum SecurityEventType {
  // Authentication events
  LOGIN_ATTEMPT = 'AUTH.LOGIN_ATTEMPT',
  LOGIN_SUCCESS = 'AUTH.LOGIN_SUCCESS',
  LOGIN_FAILURE = 'AUTH.LOGIN_FAILURE',
  LOGOUT = 'AUTH.LOGOUT',
  TOKEN_REFRESH = 'AUTH.TOKEN_REFRESH',
  TOKEN_REVOKE = 'AUTH.TOKEN_REVOKE',
  PASSWORD_RESET_REQUEST = 'AUTH.PASSWORD_RESET_REQUEST',
  PASSWORD_RESET_SUCCESS = 'AUTH.PASSWORD_RESET_SUCCESS',
  PASSWORD_CHANGE = 'AUTH.PASSWORD_CHANGE',
  
  // Authorization events
  ACCESS_GRANTED = 'AUTHZ.ACCESS_GRANTED',
  ACCESS_DENIED = 'AUTHZ.ACCESS_DENIED',
  PERMISSION_CHECK = 'AUTHZ.PERMISSION_CHECK',
  ROLE_CHANGE = 'AUTHZ.ROLE_CHANGE',
  
  // Security violations
  RATE_LIMIT_EXCEEDED = 'SECURITY.RATE_LIMIT_EXCEEDED',
  INVALID_TOKEN = 'SECURITY.INVALID_TOKEN',
  EXPIRED_TOKEN = 'SECURITY.EXPIRED_TOKEN',
  SUSPICIOUS_ACTIVITY = 'SECURITY.SUSPICIOUS_ACTIVITY',
  INJECTION_ATTEMPT = 'SECURITY.INJECTION_ATTEMPT',
  XSS_ATTEMPT = 'SECURITY.XSS_ATTEMPT',
  CSRF_ATTEMPT = 'SECURITY.CSRF_ATTEMPT',
  
  // API key events
  API_KEY_CREATED = 'API.KEY_CREATED',
  API_KEY_REVOKED = 'API.KEY_REVOKED',
  API_KEY_USED = 'API.KEY_USED',
  INVALID_API_KEY = 'API.INVALID_KEY',
  
  // Data access events
  SENSITIVE_DATA_ACCESS = 'DATA.SENSITIVE_ACCESS',
  DATA_EXPORT = 'DATA.EXPORT',
  BULK_OPERATION = 'DATA.BULK_OPERATION',
  
  // Account management
  ACCOUNT_CREATED = 'ACCOUNT.CREATED',
  ACCOUNT_UPDATED = 'ACCOUNT.UPDATED',
  ACCOUNT_DELETED = 'ACCOUNT.DELETED',
  ACCOUNT_LOCKED = 'ACCOUNT.LOCKED',
  ACCOUNT_UNLOCKED = 'ACCOUNT.UNLOCKED',
  EMAIL_VERIFIED = 'ACCOUNT.EMAIL_VERIFIED',
}

/**
 * Log security audit event
 */
export async function logSecurityEvent(event: Partial<AuditEvent>): Promise<void> {
  return tracer.startActiveSpan('security.audit', async (span) => {
    try {
      const auditEvent: AuditEvent = {
        timestamp: new Date(),
        eventType: event.eventType!,
        severity: event.severity || determineSeverity(event.eventType!),
        outcome: event.outcome || 'SUCCESS',
        details: event.details || {},
        ...event
      };
      
      // Add span attributes
      span.setAttributes({
        'audit.event_type': auditEvent.eventType,
        'audit.severity': auditEvent.severity,
        'audit.outcome': auditEvent.outcome,
        'audit.user_id': auditEvent.userId || 'anonymous',
        'audit.ip': auditEvent.ip || 'unknown'
      });
      
      // Log based on severity
      const logData = {
        ...auditEvent,
        timestamp: auditEvent.timestamp.toISOString()
      };
      
      switch (auditEvent.severity) {
        case 'CRITICAL':
          auditLogger.error('Security event', logData);
          // TODO: Send alert to security team
          break;
        case 'WARNING':
          auditLogger.warn('Security event', logData);
          break;
        default:
          auditLogger.info('Security event', logData);
      }
      
      // Store in audit trail (if configured)
      if (process.env.AUDIT_STORAGE === 'true') {
        await storeAuditEvent(auditEvent);
      }
      
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      
      // Critical: audit logging failure
      auditLogger.error('Failed to log security event', {
        error: (error as Error).message,
        originalEvent: event
      });
    } finally {
      span.end();
    }
  });
}

/**
 * Determine event severity
 */
function determineSeverity(eventType: SecurityEventType): 'INFO' | 'WARNING' | 'CRITICAL' {
  const criticalEvents = [
    SecurityEventType.INJECTION_ATTEMPT,
    SecurityEventType.XSS_ATTEMPT,
    SecurityEventType.CSRF_ATTEMPT,
    SecurityEventType.SUSPICIOUS_ACTIVITY,
    SecurityEventType.ACCOUNT_DELETED,
    SecurityEventType.DATA_EXPORT
  ];
  
  const warningEvents = [
    SecurityEventType.LOGIN_FAILURE,
    SecurityEventType.ACCESS_DENIED,
    SecurityEventType.RATE_LIMIT_EXCEEDED,
    SecurityEventType.INVALID_TOKEN,
    SecurityEventType.EXPIRED_TOKEN,
    SecurityEventType.INVALID_API_KEY,
    SecurityEventType.ACCOUNT_LOCKED
  ];
  
  if (criticalEvents.includes(eventType)) {
    return 'CRITICAL';
  }
  
  if (warningEvents.includes(eventType)) {
    return 'WARNING';
  }
  
  return 'INFO';
}

/**
 * Store audit event (placeholder for actual implementation)
 */
async function storeAuditEvent(event: AuditEvent): Promise<void> {
  // TODO: Implement storage to:
  // - Dedicated audit database
  // - SIEM system
  // - S3/blob storage for long-term retention
  
  // For now, just ensure we don't lose critical events
  if (event.severity === 'CRITICAL') {
    console.error('[CRITICAL AUDIT EVENT]', JSON.stringify(event, null, 2));
  }
}

/**
 * Extract request context for audit
 */
export function extractAuditContext(request: FastifyRequest, user?: User) {
  return {
    userId: user?.id,
    email: user?.email,
    ip: request.headers['x-forwarded-for'] as string || 
        request.headers['x-real-ip'] as string || 
        request.ip,
    userAgent: request.headers['user-agent'],
    correlationId: request.id,
    details: {
      method: request.method,
      url: request.url,
      protocol: request.protocol,
      hostname: request.hostname
    }
  };
}

/**
 * Log login attempt
 */
export async function auditLoginAttempt(
  request: FastifyRequest,
  email: string,
  success: boolean,
  reason?: string
): Promise<void> {
  const context = extractAuditContext(request);
  await logSecurityEvent({
    eventType: SecurityEventType.LOGIN_ATTEMPT,
    outcome: success ? 'SUCCESS' : 'FAILURE',
    reason,
    ...context,
    email // Override context email with the one provided
  });
  
  if (success) {
    const successContext = extractAuditContext(request);
    await logSecurityEvent({
      eventType: SecurityEventType.LOGIN_SUCCESS,
      ...successContext,
      email
    });
  } else {
    const failureContext = extractAuditContext(request);
    await logSecurityEvent({
      eventType: SecurityEventType.LOGIN_FAILURE,
      reason,
      ...failureContext,
      email
    });
  }
}

/**
 * Log access control decision
 */
export async function auditAccessControl(
  request: FastifyRequest,
  resource: string,
  action: string,
  allowed: boolean,
  user?: User
): Promise<void> {
  const context = extractAuditContext(request, user);
  await logSecurityEvent({
    eventType: allowed ? SecurityEventType.ACCESS_GRANTED : SecurityEventType.ACCESS_DENIED,
    outcome: allowed ? 'SUCCESS' : 'FAILURE',
    ...context,
    details: {
      ...context.details,
      resource,
      action,
      permissions: user?.permissions || []
    }
  });
}

/**
 * Log sensitive data access
 */
export async function auditSensitiveDataAccess(
  request: FastifyRequest,
  dataType: string,
  recordIds: string[],
  user?: User
): Promise<void> {
  const context = extractAuditContext(request, user);
  await logSecurityEvent({
    eventType: SecurityEventType.SENSITIVE_DATA_ACCESS,
    ...context,
    details: {
      ...context.details,
      dataType,
      recordCount: recordIds.length,
      recordIds: recordIds.slice(0, 10), // Log first 10 IDs only
      truncated: recordIds.length > 10
    }
  });
}

/**
 * Log security violation
 */
export async function auditSecurityViolation(
  request: FastifyRequest,
  violationType: SecurityEventType,
  details: Record<string, any>
): Promise<void> {
  const context = extractAuditContext(request);
  await logSecurityEvent({
    eventType: violationType,
    severity: 'CRITICAL',
    outcome: 'FAILURE',
    ...context,
    details: {
      ...context.details,
      ...details
    }
  });
}

/**
 * Generate audit report
 */
export async function generateAuditReport(
  _startDate: Date,
  _endDate: Date,
  _filters?: {
    userId?: string;
    eventTypes?: SecurityEventType[];
    severity?: ('INFO' | 'WARNING' | 'CRITICAL')[];
  }
): Promise<{
  summary: Record<string, number>;
  criticalEvents: AuditEvent[];
  userActivity: Record<string, number>;
}> {
  // TODO: Implement audit report generation
  // This would query the audit storage and generate statistics
  
  return {
    summary: {},
    criticalEvents: [],
    userActivity: {}
  };
}

/**
 * Compliance report generator
 */
export async function generateComplianceReport(
  _standard: 'SOC2' | 'ISO27001' | 'HIPAA' | 'PCI-DSS',
  _period: { start: Date; end: Date }
): Promise<{
  compliant: boolean;
  findings: string[];
  recommendations: string[];
}> {
  // TODO: Implement compliance report generation
  // This would analyze audit logs against compliance requirements
  
  return {
    compliant: true,
    findings: [],
    recommendations: []
  };
}
