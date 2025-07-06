# Observability Patterns

> "You can't connect the dots looking forward; you can only connect them looking backwards." - Steve Jobs

This guide ensures we can always connect the dots in our system, creating perfect visibility into every interaction, every transaction, every moment of truth.

## The Four Pillars of Observability

Like the four corners of an iPhone's design, each pillar is essential:

1. **Metrics** - The vital signs of our system
2. **Logs** - The story of what happened
3. **Traces** - The journey of each request
4. **Events** - The moments that matter

## 1. Metrics: System Vital Signs

### Prometheus Configuration

```yaml
# prometheus.yml
# Elegant metric collection, like Apple Health for your application

global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    environment: 'production'
    region: 'us-west-2'

# Alerting configuration
alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']

# Load rules
rule_files:
  - 'rules/*.yml'

# Scrape configurations
scrape_configs:
  # Application metrics
  - job_name: 'mortgage-broker-api'
    static_configs:
      - targets: ['api:3000']
    metrics_path: '/metrics'
    
  # Database metrics
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']
      
  # Redis metrics
  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']
      
  # Node metrics
  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']
```

### Key Metrics to Track

```typescript
// Metrics that matter, nothing more, nothing less
// Like iPhone's battery percentage - simple, essential

import { Counter, Histogram, Gauge, register } from 'prom-client';

// Business metrics
export const metrics = {
  // Scenario lifecycle
  scenariosCreated: new Counter({
    name: 'scenarios_created_total',
    help: 'Total number of scenarios created',
    labelNames: ['status', 'source']
  }),
  
  scenarioProcessingTime: new Histogram({
    name: 'scenario_processing_duration_seconds',
    help: 'Time to process scenario through workflow',
    labelNames: ['stage'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60]
  }),
  
  // Lender matching
  matchingAccuracy: new Gauge({
    name: 'lender_matching_accuracy',
    help: 'Accuracy of lender matching algorithm',
    labelNames: ['scenario_type']
  }),
  
  matchingDuration: new Histogram({
    name: 'lender_matching_duration_seconds',
    help: 'Time to match lenders to scenario',
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2]
  }),
  
  // Offer metrics
  offersReceived: new Counter({
    name: 'offers_received_total',
    help: 'Total offers received from lenders',
    labelNames: ['lender', 'status']
  }),
  
  offerResponseTime: new Histogram({
    name: 'offer_response_time_hours',
    help: 'Time from shopping to offer receipt',
    labelNames: ['lender'],
    buckets: [1, 6, 12, 24, 48, 72, 96]
  }),
  
  // System health
  activeConnections: new Gauge({
    name: 'db_active_connections',
    help: 'Active database connections'
  }),
  
  cacheHitRate: new Gauge({
    name: 'cache_hit_rate',
    help: 'Cache hit rate percentage',
    labelNames: ['cache_name']
  })
};

// Beautiful metric collection
export class MetricsCollector {
  static recordScenarioCreation(status: string, source: string) {
    metrics.scenariosCreated.labels(status, source).inc();
  }
  
  static recordMatchingResult(duration: number, accuracy: number, type: string) {
    metrics.matchingDuration.observe(duration);
    metrics.matchingAccuracy.labels(type).set(accuracy);
  }
  
  static recordOfferReceived(lender: string, status: string, responseHours: number) {
    metrics.offersReceived.labels(lender, status).inc();
    metrics.offerResponseTime.labels(lender).observe(responseHours);
  }
}
```

## 2. Logs: Structured Storytelling

### Log Schema

```typescript
// Every log tells a story, structured and searchable
// Like iOS Console logs, but beautiful

interface LogSchema {
  // Core fields
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  
  // Context
  service: string;
  version: string;
  environment: string;
  
  // Request context
  requestId?: string;
  userId?: string;
  sessionId?: string;
  
  // Business context
  scenarioId?: string;
  lenderId?: string;
  offerId?: string;
  
  // Technical context
  duration?: number;
  statusCode?: number;
  errorCode?: string;
  stackTrace?: string;
  
  // Metadata
  metadata?: Record<string, any>;
}

// Elegant logger implementation
class Logger {
  private static instance: Logger;
  
  private constructor() {}
  
  static getInstance(): Logger {
    if (!this.instance) {
      this.instance = new Logger();
    }
    return this.instance;
  }
  
  private formatLog(level: string, message: string, context?: any): LogSchema {
    return {
      timestamp: new Date().toISOString(),
      level: level as any,
      message,
      service: process.env.SERVICE_NAME || 'mortgage-broker-api',
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      ...context
    };
  }
  
  info(message: string, context?: any) {
    const log = this.formatLog('info', message, context);
    console.log(JSON.stringify(log));
  }
  
  error(message: string, error: Error, context?: any) {
    const log = this.formatLog('error', message, {
      ...context,
      errorCode: error.name,
      stackTrace: error.stack
    });
    console.error(JSON.stringify(log));
  }
  
  // Business event logging
  logScenarioEvent(event: string, scenario: any, metadata?: any) {
    this.info(`Scenario ${event}`, {
      scenarioId: scenario.id,
      userId: scenario.userId,
      metadata: {
        status: scenario.status,
        confidence: scenario.confidenceScore,
        ...metadata
      }
    });
  }
}
```

### Log Aggregation

```yaml
# fluentd.conf
# Elegant log collection and transformation

<source>
  @type forward
  port 24224
</source>

# Parse application logs
<filter app.**>
  @type parser
  format json
  key_name log
  reserve_data true
</filter>

# Add metadata
<filter app.**>
  @type record_transformer
  <record>
    hostname ${hostname}
    tag ${tag}
    timestamp ${time}
  </record>
</filter>

# Business metrics from logs
<match app.business.**>
  @type elasticsearch
  host elasticsearch
  port 9200
  index_name business-events
  type_name event
  
  <buffer>
    @type memory
    flush_interval 10s
    chunk_limit_size 5M
    queue_limit_length 32
    retry_max_interval 30
  </buffer>
</match>

# System logs
<match app.system.**>
  @type elasticsearch
  host elasticsearch
  port 9200
  index_name system-logs
  type_name log
</match>
```

## 3. Distributed Tracing: The Journey

### OpenTelemetry Configuration

```typescript
// Tracing every request like following a user's journey through an Apple Store
// Every interaction matters, every step is intentional

import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';

// Initialize tracing
const provider = new NodeTracerProvider({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'mortgage-broker-api',
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.APP_VERSION,
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV,
  }),
});

// Configure exporter
const jaegerExporter = new JaegerExporter({
  endpoint: 'http://jaeger:14268/api/traces',
});

provider.addSpanProcessor(new BatchSpanProcessor(jaegerExporter));
provider.register();

// Trace decorators for clean code
export function Trace(spanName?: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const tracer = trace.getTracer('mortgage-broker-api');
      const span = tracer.startSpan(spanName || `${target.constructor.name}.${propertyName}`);
      
      try {
        // Add context
        span.setAttributes({
          'function.name': propertyName,
          'function.args': JSON.stringify(args),
        });
        
        const result = await method.apply(this, args);
        
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.recordException(error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
        throw error;
      } finally {
        span.end();
      }
    };
  };
}

// Usage example
class ScenarioService {
  @Trace('scenario.match_lenders')
  async matchLenders(scenarioId: string) {
    const span = trace.getActiveSpan();
    
    // Add business context
    span?.setAttributes({
      'scenario.id': scenarioId,
      'business.operation': 'lender_matching',
    });
    
    // Your matching logic here
  }
}
```

## 4. Events: Moments That Matter

### Event Schema

```typescript
// Events are the heartbeat of the system
// Like iOS system events, but for business moments

interface BusinessEvent {
  eventId: string;
  eventType: string;
  eventTime: Date;
  aggregateId: string;
  aggregateType: string;
  eventData: any;
  metadata: {
    userId: string;
    correlationId: string;
    causationId?: string;
    version: number;
  };
}

// Event store implementation
class EventStore {
  async append(event: BusinessEvent): Promise<void> {
    // Store in database
    await db.query(`
      INSERT INTO events (
        event_id, event_type, event_time, 
        aggregate_id, aggregate_type, 
        event_data, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      event.eventId,
      event.eventType,
      event.eventTime,
      event.aggregateId,
      event.aggregateType,
      JSON.stringify(event.eventData),
      JSON.stringify(event.metadata)
    ]);
    
    // Publish to event bus
    await eventBus.publish(event);
  }
  
  async getEvents(aggregateId: string, fromVersion?: number): Promise<BusinessEvent[]> {
    const result = await db.query(`
      SELECT * FROM events 
      WHERE aggregate_id = $1 
      ${fromVersion ? 'AND metadata->>"version" > $2' : ''}
      ORDER BY event_time ASC
    `, fromVersion ? [aggregateId, fromVersion] : [aggregateId]);
    
    return result.rows.map(row => ({
      ...row,
      eventData: JSON.parse(row.event_data),
      metadata: JSON.parse(row.metadata)
    }));
  }
}
```

## 5. Dashboards: The Control Center

### Grafana Dashboard Configuration

```json
{
  "dashboard": {
    "title": "Mortgage Broker Pro - Operations Center",
    "panels": [
      {
        "title": "Scenario Flow",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(scenarios_created_total[5m])",
            "legendFormat": "Created"
          },
          {
            "expr": "rate(scenarios_shopped_total[5m])",
            "legendFormat": "Shopped"
          },
          {
            "expr": "rate(scenarios_completed_total[5m])",
            "legendFormat": "Completed"
          }
        ]
      },
      {
        "title": "Lender Response Times",
        "type": "heatmap",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, offer_response_time_hours)",
            "format": "heatmap"
          }
        ]
      },
      {
        "title": "System Health Score",
        "type": "stat",
        "targets": [
          {
            "expr": "(1 - rate(errors_total[5m]) / rate(requests_total[5m])) * 100",
            "legendFormat": "Health %"
          }
        ]
      }
    ]
  }
}
```

## 6. Alerting: Proactive Excellence

### Alert Rules

```yaml
# alerts.yml
# Alerts that matter, nothing that doesn't

groups:
  - name: business_alerts
    rules:
      # Scenario processing delays
      - alert: ScenarioProcessingDelay
        expr: histogram_quantile(0.95, scenario_processing_duration_seconds) > 300
        for: 5m
        labels:
          severity: warning
          team: platform
        annotations:
          summary: "Scenario processing is slow"
          description: "95th percentile processing time is {{ $value }}s"
      
      # Low offer response rate
      - alert: LowOfferResponseRate
        expr: |
          rate(offers_received_total[1h]) / 
          rate(scenarios_shopped_total[1h]) < 0.5
        for: 30m
        labels:
          severity: critical
          team: business
        annotations:
          summary: "Low offer response rate from lenders"
          description: "Only {{ $value | humanizePercentage }} response rate"
      
      # System health
      - alert: HighErrorRate
        expr: rate(errors_total[5m]) > 0.01
        for: 5m
        labels:
          severity: critical
          team: platform
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }}"
```

## The Observability Mindset

> "Innovation distinguishes between a leader and a follower." - Steve Jobs

Great observability isn't just about collecting data—it's about understanding your system so deeply that you can predict and prevent issues before users ever notice them.

Like Apple's approach to product design, every metric, log, and trace should serve a purpose. If it doesn't help you make the system better, it shouldn't be there.

### Best Practices

1. **Instrument with intention** - Every metric should answer a question
2. **Structure for searchability** - Logs should be instantly queryable
3. **Trace the journey** - Follow the user's path through the system
4. **Alert on symptoms, not causes** - Users care about outcomes
5. **Visualize for insight** - Dashboards should tell a story

When done right, observability becomes invisible—until you need it. Then it's there, perfect and complete, ready to help you understand and improve your system.
