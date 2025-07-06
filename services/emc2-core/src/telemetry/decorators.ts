/**
 * Tracing Decorators
 * 
 * TypeScript decorators for easy function instrumentation
 */

import { trace, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { createLogger } from '../utils/observableLogger';

const logger = createLogger('tracing');

/**
 * Trace a method execution
 */
export function Trace(spanName?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const className = target.constructor.name;
    const methodName = propertyKey;
    const name = spanName || `${className}.${methodName}`;

    descriptor.value = async function (...args: any[]) {
      const tracer = trace.getTracer('emc2-core');
      
      return tracer.startActiveSpan(name, async (span) => {
        try {
          // Add method metadata
          span.setAttributes({
            'code.function': methodName,
            'code.namespace': className,
            'code.arguments.count': args.length,
          });

          // Execute the original method
          const result = await originalMethod.apply(this, args);
          
          // Mark as successful
          span.setStatus({ code: SpanStatusCode.OK });
          
          return result;
        } catch (error) {
          // Record the error
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : 'Unknown error',
          });
          
          if (error instanceof Error) {
            span.recordException(error);
          }
          
          throw error;
        } finally {
          span.end();
        }
      });
    };

    return descriptor;
  };
}

/**
 * Trace a database operation
 */
export function TraceDB(operation: string, table?: string) {
  return function (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const tracer = trace.getTracer('emc2-core');
      const spanName = `db.${operation}${table ? `.${table}` : ''}`;
      
      return tracer.startActiveSpan(spanName, { kind: SpanKind.CLIENT }, async (span) => {
        try {
          // Add database attributes
          span.setAttributes({
            'db.system': 'postgresql',
            'db.operation': operation,
            'db.statement': args[0], // Assuming first arg is SQL
          });
          
          if (table) {
            span.setAttribute('db.sql.table', table);
          }

          const startTime = Date.now();
          const result = await originalMethod.apply(this, args);
          const duration = Date.now() - startTime;
          
          span.setAttribute('db.rows_affected', result.rowCount || 0);
          span.setAttribute('db.duration', duration);
          
          span.setStatus({ code: SpanStatusCode.OK });
          
          return result;
        } catch (error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : 'Database error',
          });
          
          if (error instanceof Error) {
            span.recordException(error);
          }
          
          throw error;
        } finally {
          span.end();
        }
      });
    };

    return descriptor;
  };
}

/**
 * Trace an HTTP client request
 */
export function TraceHTTP(serviceName: string) {
  return function (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const tracer = trace.getTracer('emc2-core');
      const spanName = `http.${serviceName}`;
      
      return tracer.startActiveSpan(spanName, { kind: SpanKind.CLIENT }, async (span) => {
        try {
          // Add HTTP attributes
          span.setAttributes({
            'http.service': serviceName,
            'peer.service': serviceName,
          });

          const result = await originalMethod.apply(this, args);
          
          span.setStatus({ code: SpanStatusCode.OK });
          
          return result;
        } catch (error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : 'HTTP error',
          });
          
          if (error instanceof Error) {
            span.recordException(error);
          }
          
          throw error;
        } finally {
          span.end();
        }
      });
    };

    return descriptor;
  };
}

/**
 * Measure method execution time
 */
export function Measure(metricName?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const className = target.constructor.name;
    const methodName = propertyKey;
    const name = metricName || `${className}.${methodName}`;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      
      try {
        const result = await originalMethod.apply(this, args);
        const duration = Date.now() - startTime;
        
        logger.info(`${name} completed`, { duration, success: true });
        
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        logger.error(`${name} failed`, error, { duration, success: false });
        
        throw error;
      }
    };

    return descriptor;
  };
}
