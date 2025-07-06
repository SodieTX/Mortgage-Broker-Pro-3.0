/**
 * Authentication Middleware
 * 
 * Production-ready auth middleware with session validation, rate limiting, and RBAC
 */

import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { AuthService } from '../services/authService';
import { RBACService } from '../services/rbacService';
import { logger } from '../utils/logger';
import { AuthAction } from '../types/auth';

declare module 'fastify' {
  interface FastifyRequest {
    sessionId?: string;
  }
}

/**
 * Initialize auth middleware
 */
export function initializeAuthMiddleware(
  fastify: FastifyInstance,
  authService: AuthService,
  rbacService: RBACService
) {
  // Enhanced JWT verification with session check
  fastify.decorate('authenticate', async function(request: FastifyRequest, reply: FastifyReply) {
    try {
      await request.jwtVerify();
      
      // Check if session exists and is not blacklisted
      if (request.user.sessionId) {
        const isBlacklisted = await authService.isSessionBlacklisted(request.user.sessionId);
        if (isBlacklisted) {
          await authService.logAuthEvent(
            AuthAction.SESSION_EXPIRED,
            request.user.id,
            { reason: 'Session blacklisted' },
            request.ip,
            request.headers['user-agent'] as string
          );
          
          return reply.code(401).send({
            success: false,
            error: 'Session expired',
            code: 'SESSION_EXPIRED'
          });
        }
        
        // Store session ID for later use
        request.sessionId = request.user.sessionId;
      }
    } catch (err) {
      logger.error('Authentication failed', { error: err });
      return reply.code(401).send({
        success: false,
        error: 'Unauthorized',
        code: 'INVALID_TOKEN'
      });
    }
  });

  // Permission checking decorator
  fastify.decorate('authorize', function(resource: string, action: string) {
    return async function(request: FastifyRequest, reply: FastifyReply) {
      try {
        // First authenticate
        await request.jwtVerify();
        
        // Check session
        if (request.user.sessionId) {
          const isBlacklisted = await authService.isSessionBlacklisted(request.user.sessionId);
          if (isBlacklisted) {
            return reply.code(401).send({
              success: false,
              error: 'Session expired',
              code: 'SESSION_EXPIRED'
            });
          }
        }
        
        // Check permission
        const hasPermission = await rbacService.hasPermission(
          request.user.id,
          resource,
          action
        );
        
        if (!hasPermission) {
          await authService.logAuthEvent(
            AuthAction.PERMISSION_DENIED,
            request.user.id,
            { resource, action },
            request.ip,
            request.headers['user-agent'] as string
          );
          
          return reply.code(403).send({
            success: false,
            error: 'Insufficient permissions',
            code: 'PERMISSION_DENIED',
            required: { resource, action }
          });
        }
      } catch (err) {
        logger.error('Authorization failed', { error: err });
        return reply.code(401).send({
          success: false,
          error: 'Unauthorized',
          code: 'INVALID_TOKEN'
        });
      }
    };
  });

  // Optional authentication (for routes that work with or without auth)
  fastify.decorate('optionalAuth', async function(request: FastifyRequest, _reply: FastifyReply) {
    try {
      if (request.headers.authorization) {
        await request.jwtVerify();
        
        // Check session if authenticated
        if (request.user?.sessionId) {
          const isBlacklisted = await authService.isSessionBlacklisted(request.user.sessionId);
          if (isBlacklisted) {
            // For optional auth, we just clear the user instead of failing
            (request as any).user = undefined;
          } else {
            request.sessionId = request.user.sessionId;
          }
        }
      }
    } catch (err) {
      // For optional auth, we don't fail on errors
      (request as any).user = undefined;
    }
  });

  // Add request hooks for audit logging
  fastify.addHook('onRequest', async (request, _reply) => {
    // Log API access for authenticated requests
    if (request.user) {
      logger.info('API Request', {
        userId: request.user.id,
        method: request.method,
        url: request.url,
        ip: request.ip,
        userAgent: request.headers['user-agent']
      });
    }
  });
}

/**
 * Rate limiting configuration for auth endpoints
 */
export const authRateLimits = {
  login: {
    max: 5,
    timeWindow: '15 minutes',
    skipSuccessfulRequests: true,
    keyGenerator: (req: FastifyRequest) => (req.body as any)?.email || req.ip
  },
  register: {
    max: 3,
    timeWindow: '1 hour',
    keyGenerator: (req: FastifyRequest) => req.ip
  },
  passwordReset: {
    max: 3,
    timeWindow: '1 hour',
    keyGenerator: (req: FastifyRequest) => (req.body as any)?.email || req.ip
  },
  default: {
    max: 100,
    timeWindow: '1 minute'
  }
};

/**
 * Security headers configuration
 */
export const securityHeaders = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Permitted-Cross-Domain-Policies': 'none',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
};
