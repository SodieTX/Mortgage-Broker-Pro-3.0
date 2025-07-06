# Observability Guide

## Quick Start

### 1. Start the Observability Stack

```bash
# Start Jaeger, Prometheus, and Grafana
npm run observability:start

# Check status
npm run observability:status
```

### 2. Access the UIs

- **Jaeger**: http://localhost:16686 - View distributed traces
- **Prometheus**: http://localhost:9090 - Query metrics
- **Grafana**: http://localhost:3333 - Dashboards (admin/admin)

### 3. Start Your Application

The application will automatically send telemetry data to the local stack.

```bash
npm run dev
```

## Features Implemented

### 1. Distributed Tracing

Every request is automatically traced with:
- Unique trace ID
- Correlation ID propagation
- Span context across services
- Error tracking

#### View a Trace

1. Make a request to your API
2. Open Jaeger UI: http://localhost:16686
3. Select "emc2-core" service
4. Click "Find Traces"
5. Click on any trace to see the full request flow

### 2. Metrics Collection

Automatic metrics:
- HTTP request duration and count
- Database query performance
- Business metrics (scenarios, reports)
- Error rates

#### Query Metrics

1. Open Prometheus: http://localhost:9090
2. Try these queries:
   - `http_requests_total` - Total requests
   - `http_request_duration_seconds` - Request latency
   - `rate(http_requests_total[5m])` - Request rate

### 3. Structured Logging

All logs include:
- Correlation ID
- Trace ID and Span ID
- Service metadata
- User context

#### Example Log Entry

```json
{
  "timestamp": "2024-01-06T21:00:00.000Z",
  "level": "info",
  "service": "emc2-core",
  "version": "0.0.1",
  "environment": "development",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "traceId": "5e2d8a9f3c5b4a6d8e9f0a1b2c3d4e5f",
  "spanId": "1a2b3c4d5e6f7890",
  "message": "Scenario created successfully",
  "userId": "user-123",
  "duration": 45
}
```

## Using Observability in Your Code

### 1. Automatic Instrumentation

HTTP endpoints, database queries, and external calls are automatically instrumented.

### 2. Custom Spans

```typescript
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('emc2-core');

async function complexOperation() {
  return tracer.startActiveSpan('complex-operation', async (span) => {
    try {
      // Your code here
      span.setAttribute('custom.attribute', 'value');
      
      const result = await doWork();
      
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  });
}
```

### 3. Using Decorators

```typescript
import { Trace, TraceDB, Measure } from '../telemetry/decorators';

class ScenarioService {
  @Trace('scenario.create')
  @Measure()
  async createScenario(data: any) {
    // Automatically traced and measured
    return await this.save(data);
  }
  
  @TraceDB('insert', 'scenarios')
  async save(data: any) {
    // Database operation automatically traced
    return await db.query('INSERT INTO scenarios...', [data]);
  }
}
```

### 4. Recording Business Metrics

```typescript
import { recordBusinessMetrics, recordCalculationDuration } from '../telemetry/metrics';

// Record a business event
recordBusinessMetrics('scenario_created', {
  user_type: 'broker',
  product_type: 'fixed_rate'
});

// Record operation duration
const start = Date.now();
const result = await calculateMortgage(data);
recordCalculationDuration('mortgage_calculation', Date.now() - start, {
  calculation_type: 'affordability'
});
```

### 5. Enhanced Logging

```typescript
import { createLogger } from '../utils/observableLogger';

const logger = createLogger('ScenarioService');

// Logs include trace context automatically
logger.info('Creating scenario', { userId, scenarioType });

// Measure operations with automatic logging
await logger.measure('scenario.validation', async () => {
  return await validateScenario(data);
}, { scenarioId });
```

## Debugging with Observability

### Finding Slow Requests

1. Open Jaeger
2. Sort by duration
3. Click on slow traces
4. Identify bottlenecks in the waterfall view

### Correlating Logs and Traces

1. Find a log entry with an error
2. Copy the traceId
3. Search in Jaeger: `traceID=<copied-id>`
4. See the full request context

### Monitoring Error Rates

1. Open Grafana
2. Import the provided dashboard
3. View error rates by endpoint
4. Set up alerts for thresholds

## Production Considerations

### 1. Sampling

For high-volume production:

```typescript
// Configure sampling in telemetry/index.ts
import { TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-node';

// Sample 10% of traces
sampler: new TraceIdRatioBasedSampler(0.1),
```

### 2. Data Retention

Configure retention policies:
- Traces: 7-30 days
- Metrics: 30-90 days
- Logs: 7-30 days

### 3. Security

- Never log sensitive data (passwords, tokens, PII)
- Use the redact configuration in logger
- Control access to observability tools

### 4. Cost Management

- Use sampling for high-volume endpoints
- Aggregate metrics before sending
- Archive old data to cold storage

## Troubleshooting

### No Traces Appearing

1. Check the observability stack is running: `npm run observability:status`
2. Verify OTLP endpoints are correct (default: http://localhost:4318)
3. Check application logs for OpenTelemetry errors

### Missing Metrics

1. Ensure Prometheus is scraping: http://localhost:9090/targets
2. Check the /metrics endpoint: http://localhost:3001/metrics
3. Verify metric names in queries

### Performance Impact

Observability typically adds <5% overhead. If you see higher:
1. Enable sampling
2. Reduce metric cardinality
3. Batch exports more aggressively

## Next Steps

1. Create custom Grafana dashboards
2. Set up alerting rules
3. Integrate with your logging platform
4. Add custom business metrics
5. Implement SLO/SLI tracking
