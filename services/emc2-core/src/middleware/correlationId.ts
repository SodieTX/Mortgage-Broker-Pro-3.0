/**
 * Correlation ID Middleware
 * 
 * Adds correlation ID to all requests for distributed tracing
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { trace } from '@opentelemetry/api';

declare module 'fastify' {
  interface FastifyRequest {
    correlationId: string;
  }
}

export interface CorrelationIdOptions {
  headerName?: string;
  generateId?: () => string;
}

export function correlationIdPlugin(options: CorrelationIdOptions = {}) {
  const headerName = options.headerName || 'x-correlation-id';
  const generateId = options.generateId || uuidv4;

  return async function (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    // Get or generate correlation ID
    const correlationId = request.headers[headerName] as string || generateId();
    
    // Attach to request
    request.correlationId = correlationId;
    
    // Add to response headers
    reply.header(headerName, correlationId);
    
    // Add to current span
    const span = trace.getActiveSpan();
    if (span) {
      span.setAttribute('correlation.id', correlationId);
    }
    
    // Add to log context
    request.log = request.log.child({ correlationId });
  };
}

/**
 * Extract correlation ID from context
 */
export function getCorrelationId(req?: FastifyRequest): string | undefined {
  if (req?.correlationId) {
    return req.correlationId;
  }
  
  // Try to get from active span
  const span = trace.getActiveSpan();
  if (span) {
    const spanContext = span.spanContext();
    return spanContext.traceId;
  }
  
  return undefined;
}

/**
 * Propagate correlation ID to outgoing requests
 */
export function propagateCorrelationId(headers: Record<string, string>, correlationId?: string): Record<string, string> {
  const id = correlationId || getCorrelationId();
  
  if (id) {
    return {
      ...headers,
      'x-correlation-id': id,
    };
  }
  
  return headers;
}
