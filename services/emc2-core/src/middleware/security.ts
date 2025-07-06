/**
 * Security Middleware
 * 
 * World-class security implementation with defense in depth
 */

import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { createHash } from 'crypto';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { createLogger } from '../utils/observableLogger';
import { loginAttempts } from '../telemetry/metrics';

const logger = createLogger('security');
const tracer = trace.getTracer('emc2-core');

export interface SecurityOptions {
  cors?: {
    origin?: string | string[] | boolean;
    credentials?: boolean;
    methods?: string[];
  };
  rateLimit?: {
    global?: number;
    auth?: number;
    api?: number;
  };
  csrf?: boolean;
  xss?: boolean;
}

/**
 * Apply comprehensive security middleware
 */
export async function applySecurity(
  fastify: FastifyInstance, 
  options: SecurityOptions = {}
) {
  // Helmet for security headers
  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https:"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // For Swagger UI
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", "https:"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false, // For Swagger UI
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  });

  // CORS configuration
  await fastify.register(cors, {
    origin: options.cors?.origin || process.env.CORS_ORIGIN?.split(',') || true,
    credentials: options.cors?.credentials ?? true,
    methods: options.cors?.methods || ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID', 'X-API-Key'],
    exposedHeaders: ['X-Correlation-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset']
  });

  // Global rate limiting
  await fastify.register(rateLimit, {
    global: true,
    max: options.rateLimit?.global || 100,
    timeWindow: '1 minute',
    cache: 10000,
    allowList: ['127.0.0.1', '::1'], // Localhost bypass
    redis: (fastify as any).redis, // Use Redis if available
    keyGenerator: (request: FastifyRequest) => {
      // Use API key if present, otherwise IP
      return request.headers['x-api-key'] as string || 
             request.headers['x-forwarded-for'] as string || 
             request.ip;
    },
    errorResponseBuilder: (request: FastifyRequest, context) => {
      return {
        statusCode: 429,
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Try again in ${context.after}`,
        retryAfter: context.after,
        correlationId: request.id
      };
    },
    onExceeding: (request: FastifyRequest) => {
      logger.warn('Rate limit approaching', {
        ip: request.ip,
        url: request.url,
        correlationId: request.id
      });
    },
    onExceeded: (request: FastifyRequest) => {
      logger.error('Rate limit exceeded', {
        ip: request.ip,
        url: request.url,
        correlationId: request.id
      });
    }
  });

  // Auth endpoints specific rate limiting
  fastify.register(async function authRateLimit(fastify) {
    await fastify.register(rateLimit, {
      max: options.rateLimit?.auth || 5,
      timeWindow: '1 minute',
      errorResponseBuilder: (request: FastifyRequest) => {
        loginAttempts.add(1, { result: 'rate_limited' });
        return {
          statusCode: 429,
          error: 'Too Many Requests',
          message: 'Too many login attempts. Please try again later.',
          correlationId: request.id
        };
      }
    });
  }, { prefix: '/auth/login' });

  // Apply security hooks
  fastify.addHook('onRequest', securityHeaders);
  fastify.addHook('onRequest', preventTimingAttacks);
  fastify.addHook('preHandler', validateContentType);
  fastify.addHook('preHandler', sanitizeInput);
  
  if (options.xss !== false) {
    fastify.addHook('preSerialization', xssProtection);
  }
}

/**
 * Add additional security headers
 */
async function securityHeaders(_request: FastifyRequest, reply: FastifyReply) {
  reply.headers({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
}

/**
 * Prevent timing attacks on sensitive operations
 */
async function preventTimingAttacks(request: FastifyRequest, _reply: FastifyReply) {
  // Add random delay to auth endpoints
  if (request.url.startsWith('/auth/')) {
    const delay = Math.floor(Math.random() * 100); // 0-100ms random delay
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

/**
 * Validate content type to prevent CSRF
 */
async function validateContentType(request: FastifyRequest, reply: FastifyReply) {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    const contentType = request.headers['content-type'];
    
    if (!contentType || !contentType.includes('application/json')) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Content-Type must be application/json',
        correlationId: request.id
      });
    }
  }
}

/**
 * Sanitize input to prevent injection attacks
 */
async function sanitizeInput(request: FastifyRequest, reply: FastifyReply) {
  return tracer.startActiveSpan('security.sanitize', async (span) => {
    try {
      if (request.body && typeof request.body === 'object') {
        request.body = sanitizeObject(request.body);
      }
      
      if (request.query && typeof request.query === 'object') {
        request.query = sanitizeObject(request.query);
      }
      
      if (request.params && typeof request.params === 'object') {
        request.params = sanitizeObject(request.params);
      }
      
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid input detected',
        correlationId: request.id
      });
    } finally {
      span.end();
    }
  });
}

/**
 * Recursively sanitize object
 */
export function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (typeof obj === 'object') {
    const sanitized: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      // Check for prototype pollution
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        logger.warn('Prototype pollution attempt detected', { key });
        continue;
      }
      
      // Sanitize key
      const sanitizedKey = sanitizeString(key);
      
      // Sanitize value
      if (typeof value === 'string') {
        sanitized[sanitizedKey] = sanitizeString(value);
      } else {
        sanitized[sanitizedKey] = sanitizeObject(value);
      }
    }
    
    return sanitized;
  }
  
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  
  return obj;
}

/**
 * Sanitize string to prevent injection
 */
function sanitizeString(str: string): string {
  // Remove null bytes
  str = str.replace(/\0/g, '');
  
  // Limit length to prevent DoS
  if (str.length > 10000) {
    str = str.substring(0, 10000);
  }
  
  // Remove potential SQL injection patterns
  const sqlPatterns = [
    /(\b)(union)(\s+)(select|all)/gi,
    /(\b)(select|insert|update|delete|drop|create|alter)(\s+)/gi,
    /(-{2}|\/\*|\*\/)/g, // SQL comments
    /(;|\||\\)/g // Command separators
  ];
  
  for (const pattern of sqlPatterns) {
    str = str.replace(pattern, '');
  }
  
  // Remove potential NoSQL injection patterns
  str = str.replace(/[${}]/g, '');
  
  return str.trim();
}

/**
 * XSS protection in responses
 */
async function xssProtection(
  _request: FastifyRequest,
  _reply: FastifyReply,
  payload: any
): Promise<any> {
  if (typeof payload === 'string') {
    return escapeHtml(payload);
  }
  
  if (typeof payload === 'object' && payload !== null) {
    return escapeObject(payload);
  }
  
  return payload;
}

/**
 * Escape HTML in object
 */
function escapeObject(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(item => escapeObject(item));
  }
  
  if (typeof obj === 'object' && obj !== null) {
    const escaped: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        escaped[key] = escapeHtml(value);
      } else {
        escaped[key] = escapeObject(value);
      }
    }
    
    return escaped;
  }
  
  return obj;
}

/**
 * Escape HTML characters
 */
function escapeHtml(str: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;'
  };
  
  return str.replace(/[&<>"'\/]/g, char => htmlEscapes[char]);
}

/**
 * Generate API key
 */
export function generateApiKey(clientId: string): string {
  const secret = process.env.API_KEY_SECRET || 'default-secret';
  const timestamp = Date.now();
  const data = `${clientId}:${timestamp}:${secret}`;
  
  const hash = createHash('sha256').update(data).digest('hex');
  const key = Buffer.from(`${clientId}:${timestamp}:${hash}`).toString('base64');
  
  return key.replace(/[+\/=]/g, char => {
    switch (char) {
      case '+': return '-';
      case '/': return '_';
      case '=': return '';
      default: return char;
    }
  });
}

/**
 * Validate API key
 */
export function validateApiKey(apiKey: string): { valid: boolean; clientId?: string } {
  try {
    // Decode base64
    const decoded = Buffer.from(
      apiKey.replace(/-/g, '+').replace(/_/g, '/'),
      'base64'
    ).toString();
    
    const [clientId, timestamp, hash] = decoded.split(':');
    
    // Check timestamp (keys expire after 1 year)
    const keyAge = Date.now() - parseInt(timestamp);
    if (keyAge > 365 * 24 * 60 * 60 * 1000) {
      return { valid: false };
    }
    
    // Verify hash
    const secret = process.env.API_KEY_SECRET || 'default-secret';
    const data = `${clientId}:${timestamp}:${secret}`;
    const expectedHash = createHash('sha256').update(data).digest('hex');
    
    if (hash !== expectedHash) {
      return { valid: false };
    }
    
    return { valid: true, clientId };
  } catch (error) {
    logger.warn('Invalid API key format', { error });
    return { valid: false };
  }
}

/**
 * API key validation middleware
 */
export async function requireApiKey(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const apiKey = request.headers['x-api-key'] as string;
  
  if (!apiKey) {
    return reply.code(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'API key required',
      correlationId: request.id
    });
  }
  
  const validation = validateApiKey(apiKey);
  
  if (!validation.valid) {
    return reply.code(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Invalid API key',
      correlationId: request.id
    });
  }
  
  // Add client ID to request
  (request as any).clientId = validation.clientId;
}
