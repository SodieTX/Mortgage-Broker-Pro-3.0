/**
 * OpenTelemetry Initialization for Hermes
 * Sets up distributed tracing and metrics
 *
 * Environment variables used:
 *   OTEL_EXPORTER_OTLP_TRACES_ENDPOINT (default: http://localhost:4318/v1/traces)
 *   OTEL_EXPORTER_OTLP_METRICS_ENDPOINT (default: http://localhost:4318/v1/metrics)
 *   NODE_ENV, npm_package_version
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
const { Resource } = require('@opentelemetry/resources');
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import app from './app';

const SERVICE_NAME = 'hermes';
const SERVICE_VERSION = process.env.npm_package_version || '0.0.1';

let shuttingDown = false;

export function initializeTelemetry(): NodeSDK {
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
      exportIntervalMillis: 10000,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-http': { enabled: true },
        '@opentelemetry/instrumentation-pg': { enhancedDatabaseReporting: true },
      }),
    ],
  });

  sdk.start().catch((err: any) => {
    // Log telemetry startup errors
    console.error('Failed to start OpenTelemetry SDK:', err);
  });

  // Graceful shutdown with double-signal protection
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    try {
      await sdk.shutdown();
      console.info('OpenTelemetry terminated');
    } catch (error) {
      console.error('Error terminating OpenTelemetry', error);
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return sdk;
}

if (require.main === module) {
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  app.listen(port, () => {
    console.log(`Hermes service listening on port ${port}`);
  });
}

export { app, trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';
