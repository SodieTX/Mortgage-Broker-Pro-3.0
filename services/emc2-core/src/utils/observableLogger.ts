/**
 * Observable Logger
 * 
 * Enhanced logger with OpenTelemetry integration
 */

import pino from 'pino';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { getCorrelationId } from '../middleware/correlationId';

// Base logger configuration
const baseLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
    bindings: (bindings) => ({
      pid: bindings.pid,
      hostname: bindings.hostname,
      service: 'emc2-core',
      version: process.env.npm_package_version || '0.0.1',
      environment: process.env.NODE_ENV || 'development',
    }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'password',
      'token',
      'authorization',
      'cookie',
      '*.password',
      '*.token',
      '*.authorization',
      '*.cookie',
      'req.headers.authorization',
      'req.headers.cookie',
    ],
    censor: '[REDACTED]',
  },
});

/**
 * Enhanced logger with tracing context
 */
export class ObservableLogger {
  private logger: pino.Logger;

  constructor(component?: string) {
    this.logger = component ? baseLogger.child({ component }) : baseLogger;
  }

  /**
   * Add trace context to log entry
   */
  private addTraceContext(obj: any = {}): any {
    const span = trace.getActiveSpan();
    if (span) {
      const spanContext = span.spanContext();
      obj.traceId = spanContext.traceId;
      obj.spanId = spanContext.spanId;
    }

    // Add correlation ID if available
    const correlationId = getCorrelationId();
    if (correlationId) {
      obj.correlationId = correlationId;
    }

    return obj;
  }

  /**
   * Log info level
   */
  info(msg: string, obj?: any): void {
    this.logger.info(this.addTraceContext(obj), msg);
  }

  /**
   * Log warning level
   */
  warn(msg: string, obj?: any): void {
    this.logger.warn(this.addTraceContext(obj), msg);
    
    // Add event to span
    const span = trace.getActiveSpan();
    if (span) {
      span.addEvent('warning', {
        message: msg,
        ...obj,
      });
    }
  }

  /**
   * Log error level
   */
  error(msg: string, error?: any, obj?: any): void {
    const errorObj = {
      ...this.addTraceContext(obj),
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : error,
    };

    this.logger.error(errorObj, msg);

    // Mark span as error
    const span = trace.getActiveSpan();
    if (span) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: msg,
      });
      
      if (error instanceof Error) {
        span.recordException(error);
      }
    }
  }

  /**
   * Log debug level
   */
  debug(msg: string, obj?: any): void {
    this.logger.debug(this.addTraceContext(obj), msg);
  }

  /**
   * Log fatal level
   */
  fatal(msg: string, error?: any, obj?: any): void {
    const errorObj = {
      ...this.addTraceContext(obj),
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : error,
    };

    this.logger.fatal(errorObj, msg);

    // Mark span as error
    const span = trace.getActiveSpan();
    if (span) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: `FATAL: ${msg}`,
      });
    }
  }

  /**
   * Create child logger
   */
  child(bindings: any): ObservableLogger {
    const childLogger = Object.create(this);
    childLogger.logger = this.logger.child(bindings);
    return childLogger;
  }

  /**
   * Measure operation duration
   */
  async measure<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: any
  ): Promise<T> {
    const startTime = Date.now();
    const span = trace.getActiveSpan();
    
    try {
      this.debug(`Starting ${operation}`, metadata);
      const result = await fn();
      
      const duration = Date.now() - startTime;
      this.info(`Completed ${operation}`, {
        ...metadata,
        duration,
        success: true,
      });
      
      if (span) {
        span.addEvent(`${operation}.completed`, {
          duration,
          ...metadata,
        });
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.error(`Failed ${operation}`, error, {
        ...metadata,
        duration,
        success: false,
      });
      
      if (span) {
        span.addEvent(`${operation}.failed`, {
          duration,
          error: error instanceof Error ? error.message : String(error),
          ...metadata,
        });
      }
      
      throw error;
    }
  }
}

// Export singleton instance
export const observableLogger = new ObservableLogger();

// Export for component-specific loggers
export function createLogger(component: string): ObservableLogger {
  return new ObservableLogger(component);
}
