/**
 * OpenTelemetry Initialization
 * 
 * Sets up distributed tracing, metrics, and instrumentation
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
const { Resource } = require('@opentelemetry/resources');
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { logger } from '../utils/logger';

// Service information
const SERVICE_NAME = 'emc2-core';
const SERVICE_VERSION = process.env.npm_package_version || '0.0.1';

/**
 * Initialize OpenTelemetry
 */
export function initializeTelemetry(): NodeSDK {
  logger.info('Initializing OpenTelemetry...');

  // Configure resource
  const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: SERVICE_NAME,
    [SemanticResourceAttributes.SERVICE_VERSION]: SERVICE_VERSION,
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
  });

  // Configure trace exporter
  const traceExporter = new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'http://localhost:4318/v1/traces',
    headers: {},
  });

  // Configure metric exporter
  const metricExporter = new OTLPMetricExporter({
    url: process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT || 'http://localhost:4318/v1/metrics',
    headers: {},
  });

  // Create SDK
  const sdk = new NodeSDK({
    resource,
    spanProcessor: new BatchSpanProcessor(traceExporter),
    metricReader: new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: 10000, // Export every 10 seconds
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable fs instrumentation to reduce noise
        '@opentelemetry/instrumentation-fs': {
          enabled: false,
        },
        // Configure HTTP instrumentation
        '@opentelemetry/instrumentation-http': {
          enabled: true,
        },
        // Configure database instrumentation
        '@opentelemetry/instrumentation-pg': {
          enhancedDatabaseReporting: true,
        },
      }),
    ],
  });

  // Initialize the SDK
  sdk.start();

  // Graceful shutdown
  process.on('SIGTERM', () => {
    sdk.shutdown()
      .then(() => logger.info('OpenTelemetry terminated'))
      .catch((error) => logger.error('Error terminating OpenTelemetry', error))
      .finally(() => process.exit(0));
  });

  logger.info('OpenTelemetry initialized successfully');
  return sdk;
}

// Export for use in other modules
export { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';
