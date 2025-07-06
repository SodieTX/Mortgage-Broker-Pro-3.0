/**
 * Custom Metrics Collection
 * 
 * Business and performance metrics using OpenTelemetry
 */

import { metrics } from '@opentelemetry/api';

// Get meter
const meter = metrics.getMeter('emc2-core', '0.0.1');

// HTTP metrics
export const httpRequestDuration = meter.createHistogram('http_request_duration_seconds', {
  description: 'HTTP request latency',
  unit: 'seconds',
});

export const httpRequestsTotal = meter.createCounter('http_requests_total', {
  description: 'Total number of HTTP requests',
});

export const httpRequestsActive = meter.createUpDownCounter('http_requests_active', {
  description: 'Number of active HTTP requests',
});

// Database metrics
export const dbQueryDuration = meter.createHistogram('db_query_duration_seconds', {
  description: 'Database query execution time',
  unit: 'seconds',
});

export const dbConnectionsActive = meter.createUpDownCounter('db_connections_active', {
  description: 'Number of active database connections',
});

export const dbConnectionErrors = meter.createCounter('db_connection_errors_total', {
  description: 'Total number of database connection errors',
});

// Business metrics
export const scenariosCreated = meter.createCounter('business_scenarios_created_total', {
  description: 'Total number of scenarios created',
});

export const scenariosCalculated = meter.createCounter('business_scenarios_calculated_total', {
  description: 'Total number of scenario calculations performed',
});

export const reportsGenerated = meter.createCounter('business_reports_generated_total', {
  description: 'Total number of reports generated',
});

export const calculationDuration = meter.createHistogram('business_calculation_duration_seconds', {
  description: 'Time taken to perform mortgage calculations',
  unit: 'seconds',
});

// Email metrics
export const emailsSent = meter.createCounter('emails_sent_total', {
  description: 'Total number of emails sent',
});

export const emailsFailed = meter.createCounter('emails_failed_total', {
  description: 'Total number of failed email attempts',
});

export const emailQueueDepth = meter.createUpDownCounter('email_queue_depth', {
  description: 'Current depth of email queue',
});

// Auth metrics
export const loginAttempts = meter.createCounter('auth_login_attempts_total', {
  description: 'Total number of login attempts',
});

export const loginSuccess = meter.createCounter('auth_login_success_total', {
  description: 'Total number of successful logins',
});

export const tokenRefreshes = meter.createCounter('auth_token_refreshes_total', {
  description: 'Total number of token refreshes',
});

// System metrics (these are often collected automatically, but we can add custom ones)
export const customGauge = meter.createObservableGauge('system_custom_metric', {
  description: 'Custom system metric example',
});

// Register callbacks for observable metrics
customGauge.addCallback((observableResult) => {
  // Example: measure something periodically
  observableResult.observe(Math.random() * 100, {
    source: 'example',
  });
});

/**
 * Record HTTP request metrics
 */
export function recordHttpMetrics(
  method: string,
  route: string,
  statusCode: number,
  duration: number
): void {
  const labels = {
    method,
    route,
    status_code: statusCode.toString(),
    status_class: `${Math.floor(statusCode / 100)}xx`,
  };

  httpRequestsTotal.add(1, labels);
  httpRequestDuration.record(duration / 1000, labels); // Convert to seconds
}

/**
 * Record database metrics
 */
export function recordDbMetrics(
  operation: string,
  table: string,
  duration: number,
  success: boolean
): void {
  const labels = {
    operation,
    table,
    status: success ? 'success' : 'error',
  };

  dbQueryDuration.record(duration / 1000, labels);
  
  if (!success) {
    dbConnectionErrors.add(1, { operation, table });
  }
}

/**
 * Record business metrics
 */
export function recordBusinessMetrics(
  type: 'scenario_created' | 'scenario_calculated' | 'report_generated',
  metadata?: Record<string, string>
): void {
  switch (type) {
    case 'scenario_created':
      scenariosCreated.add(1, metadata);
      break;
    case 'scenario_calculated':
      scenariosCalculated.add(1, metadata);
      break;
    case 'report_generated':
      reportsGenerated.add(1, metadata);
      break;
  }
}

/**
 * Record calculation duration
 */
export function recordCalculationDuration(
  calculationType: string,
  duration: number,
  metadata?: Record<string, string>
): void {
  calculationDuration.record(duration / 1000, {
    type: calculationType,
    ...metadata,
  });
}

/**
 * Export metrics in Prometheus format
 */
export async function getMetricsForPrometheus(): Promise<string> {
  // This would typically be handled by the OpenTelemetry Prometheus exporter
  // For now, return a placeholder
  return '# Metrics are exported via OpenTelemetry to configured backend\n';
}
