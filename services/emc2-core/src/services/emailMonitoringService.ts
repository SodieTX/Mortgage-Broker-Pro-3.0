/**
 * Email Monitoring Service
 * 
 * Tracks email metrics, performance, and health status
 */

import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import { logger } from '../utils/logger';
import { emailQueueService } from './emailQueueService';

export interface EmailMetrics {
  sent: number;
  failed: number;
  retried: number;
  queued: number;
  delivered: number;
  bounced: number;
  opened: number;
  clicked: number;
}

export interface ProviderMetrics {
  provider: string;
  sent: number;
  failed: number;
  avgLatency: number;
  lastError?: string;
  lastErrorTime?: Date;
}

export class EmailMonitoringService {
  private registry: Registry;
  
  // Counters
  private emailsSentCounter!: Counter;
  private emailsFailedCounter!: Counter;
  private emailsRetriedCounter!: Counter;
  private emailsBouncedCounter!: Counter;
  private emailsOpenedCounter!: Counter;
  private emailsClickedCounter!: Counter;
  
  // Histograms
  private emailSendDuration!: Histogram;
  private queueWaitTime!: Histogram;
  private batchProcessingTime!: Histogram;
  
  // Gauges
  private queueDepthGauge!: Gauge;
  private activeJobsGauge!: Gauge;
  private failedJobsGauge!: Gauge;
  private smtpConnectionsGauge!: Gauge;
  
  // Provider-specific metrics
  private providerMetrics: Map<string, ProviderMetrics> = new Map();
  
  // Alert thresholds
  private readonly ALERT_THRESHOLDS = {
    queueDepth: 1000,
    failureRate: 0.1, // 10%
    avgLatency: 5000, // 5 seconds
    consecutiveFailures: 5
  };
  
  // Tracking
  private consecutiveFailures = 0;
  private recentMetrics: EmailMetrics[] = [];

  constructor() {
    this.registry = new Registry();
    this.initializeMetrics();
    // Don't start monitoring immediately - wait for initialize() to be called
  }

  private initializeMetrics() {
    // Collect default metrics (CPU, memory, etc.)
    collectDefaultMetrics({ register: this.registry });

    // Email counters
    this.emailsSentCounter = new Counter({
      name: 'emails_sent_total',
      help: 'Total number of emails sent',
      labelNames: ['provider', 'template', 'status'],
      registers: [this.registry]
    });

    this.emailsFailedCounter = new Counter({
      name: 'emails_failed_total',
      help: 'Total number of failed emails',
      labelNames: ['provider', 'error_type'],
      registers: [this.registry]
    });

    this.emailsRetriedCounter = new Counter({
      name: 'emails_retried_total',
      help: 'Total number of email retries',
      labelNames: ['provider'],
      registers: [this.registry]
    });

    this.emailsBouncedCounter = new Counter({
      name: 'emails_bounced_total',
      help: 'Total number of bounced emails',
      labelNames: ['bounce_type'],
      registers: [this.registry]
    });

    this.emailsOpenedCounter = new Counter({
      name: 'emails_opened_total',
      help: 'Total number of opened emails',
      labelNames: ['template'],
      registers: [this.registry]
    });

    this.emailsClickedCounter = new Counter({
      name: 'emails_clicked_total',
      help: 'Total number of email link clicks',
      labelNames: ['template', 'link_type'],
      registers: [this.registry]
    });

    // Histograms
    this.emailSendDuration = new Histogram({
      name: 'email_send_duration_seconds',
      help: 'Email send duration in seconds',
      labelNames: ['provider', 'template'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [this.registry]
    });

    this.queueWaitTime = new Histogram({
      name: 'email_queue_wait_seconds',
      help: 'Time spent waiting in queue',
      buckets: [1, 5, 10, 30, 60, 300],
      registers: [this.registry]
    });

    this.batchProcessingTime = new Histogram({
      name: 'email_batch_processing_seconds',
      help: 'Batch processing time',
      labelNames: ['batch_size'],
      buckets: [1, 5, 10, 30, 60],
      registers: [this.registry]
    });

    // Gauges
    this.queueDepthGauge = new Gauge({
      name: 'email_queue_depth',
      help: 'Current email queue depth',
      labelNames: ['queue_type'],
      registers: [this.registry]
    });

    this.activeJobsGauge = new Gauge({
      name: 'email_active_jobs',
      help: 'Currently active email jobs',
      registers: [this.registry]
    });

    this.failedJobsGauge = new Gauge({
      name: 'email_failed_jobs',
      help: 'Failed jobs in queue',
      registers: [this.registry]
    });

    this.smtpConnectionsGauge = new Gauge({
      name: 'smtp_connections_active',
      help: 'Active SMTP connections',
      labelNames: ['provider'],
      registers: [this.registry]
    });
  }

  /**
   * Start monitoring background tasks
   */
  private startMonitoring() {
    // Update queue metrics every 10 seconds
    setInterval(async () => {
      try {
        const stats = await emailQueueService.getQueueStats();
        
        this.queueDepthGauge.set({ queue_type: 'email' }, stats.email.waiting + stats.email.delayed);
        this.queueDepthGauge.set({ queue_type: 'campaign' }, stats.campaign.waiting + stats.campaign.delayed);
        this.activeJobsGauge.set(stats.email.active + stats.campaign.active);
        this.failedJobsGauge.set(stats.email.failed + stats.campaign.failed);
        
        // Check alert conditions
        this.checkAlerts(stats);
      } catch (error) {
        // Don't log errors for queue metrics if queues aren't available
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (!errorMessage.includes('queue')) {
          logger.error('Failed to update queue metrics:', error);
        }
      }
    }, 10000);

    // Clean up old metrics every hour
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 3600000);
  }

  /**
   * Record email sent
   */
  recordEmailSent(provider: string, template: string, duration: number) {
    this.emailsSentCounter.inc({ provider, template, status: 'success' });
    this.emailSendDuration.observe({ provider, template }, duration / 1000);
    this.consecutiveFailures = 0;
    
    // Update provider metrics
    const metrics = this.providerMetrics.get(provider) || {
      provider,
      sent: 0,
      failed: 0,
      avgLatency: 0
    };
    metrics.sent++;
    metrics.avgLatency = ((metrics.avgLatency * (metrics.sent - 1)) + duration) / metrics.sent;
    this.providerMetrics.set(provider, metrics);
  }

  /**
   * Record email failure
   */
  recordEmailFailed(provider: string, errorType: string, error?: Error) {
    this.emailsFailedCounter.inc({ provider, error_type: errorType });
    this.consecutiveFailures++;
    
    // Update provider metrics
    const metrics = this.providerMetrics.get(provider) || {
      provider,
      sent: 0,
      failed: 0,
      avgLatency: 0
    };
    metrics.failed++;
    metrics.lastError = error?.message;
    metrics.lastErrorTime = new Date();
    this.providerMetrics.set(provider, metrics);
    
    // Check if we need to alert
    if (this.consecutiveFailures >= this.ALERT_THRESHOLDS.consecutiveFailures) {
      this.sendAlert('consecutive_failures', {
        count: this.consecutiveFailures,
        provider,
        error: error?.message
      });
    }
  }

  /**
   * Record email retry
   */
  recordEmailRetried(provider: string) {
    this.emailsRetriedCounter.inc({ provider });
  }

  /**
   * Record email bounce
   */
  recordEmailBounced(bounceType: 'hard' | 'soft') {
    this.emailsBouncedCounter.inc({ bounce_type: bounceType });
  }

  /**
   * Record email opened
   */
  recordEmailOpened(template: string) {
    this.emailsOpenedCounter.inc({ template });
  }

  /**
   * Record email link clicked
   */
  recordEmailClicked(template: string, linkType: string) {
    this.emailsClickedCounter.inc({ template, link_type: linkType });
  }

  /**
   * Record queue wait time
   */
  recordQueueWaitTime(waitTime: number) {
    this.queueWaitTime.observe(waitTime / 1000);
  }

  /**
   * Record batch processing
   */
  recordBatchProcessing(batchSize: number, duration: number) {
    this.batchProcessingTime.observe({ batch_size: batchSize.toString() }, duration / 1000);
  }

  /**
   * Update SMTP connections
   */
  updateSmtpConnections(provider: string, count: number) {
    this.smtpConnectionsGauge.set({ provider }, count);
  }

  /**
   * Get current metrics
   */
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /**
   * Get provider health status
   */
  getProviderHealth(): Map<string, ProviderMetrics> {
    return new Map(this.providerMetrics);
  }

  /**
   * Get failure rate for a provider
   */
  getFailureRate(provider: string): number {
    const metrics = this.providerMetrics.get(provider);
    if (!metrics || metrics.sent === 0) return 0;
    return metrics.failed / metrics.sent;
  }

  /**
   * Check for alert conditions
   */
  private async checkAlerts(stats: any) {
    const totalQueued = stats.email.waiting + stats.email.delayed + 
                       stats.campaign.waiting + stats.campaign.delayed;
    
    // Queue depth alert
    if (totalQueued > this.ALERT_THRESHOLDS.queueDepth) {
      this.sendAlert('high_queue_depth', { depth: totalQueued });
    }
    
    // Check provider failure rates
    for (const [provider, metrics] of this.providerMetrics) {
      const failureRate = this.getFailureRate(provider);
      if (failureRate > this.ALERT_THRESHOLDS.failureRate) {
        this.sendAlert('high_failure_rate', {
          provider,
          rate: failureRate,
          failed: metrics.failed,
          sent: metrics.sent
        });
      }
      
      // Check latency
      if (metrics.avgLatency > this.ALERT_THRESHOLDS.avgLatency) {
        this.sendAlert('high_latency', {
          provider,
          latency: metrics.avgLatency
        });
      }
    }
  }

  /**
   * Send alert
   */
  private sendAlert(type: string, data: any) {
    logger.error(`EMAIL ALERT [${type}]:`, data);
    
    // In production, this would send to:
    // - Slack/Discord webhook
    // - PagerDuty
    // - Email to admin
    // - SMS via Twilio
  }

  /**
   * Clean up old metrics
   */
  private cleanupOldMetrics() {
    const oneHourAgo = Date.now() - 3600000;
    this.recentMetrics = this.recentMetrics.filter(m => 
      (m as any).timestamp > oneHourAgo
    );
  }

  /**
   * Initialize the monitoring service
   */
  initialize() {
    this.startMonitoring();
    logger.info('Email monitoring service initialized');
  }

  /**
   * Get dashboard data
   */
  getDashboardData() {
    const providers = Array.from(this.providerMetrics.values());
    const totalSent = providers.reduce((sum, p) => sum + p.sent, 0);
    const totalFailed = providers.reduce((sum, p) => sum + p.failed, 0);
    
    return {
      summary: {
        totalSent,
        totalFailed,
        successRate: totalSent > 0 ? ((totalSent - totalFailed) / totalSent) * 100 : 0,
        activeProviders: providers.length
      },
      providers: providers.map(p => ({
        ...p,
        failureRate: this.getFailureRate(p.provider) * 100,
        health: this.getProviderHealthStatus(p.provider)
      })),
      alerts: {
        consecutiveFailures: this.consecutiveFailures,
        isHealthy: this.consecutiveFailures < this.ALERT_THRESHOLDS.consecutiveFailures
      }
    };
  }

  /**
   * Get provider health status
   */
  private getProviderHealthStatus(provider: string): 'healthy' | 'degraded' | 'unhealthy' {
    const metrics = this.providerMetrics.get(provider);
    if (!metrics) return 'healthy';
    
    const failureRate = this.getFailureRate(provider);
    if (failureRate > 0.2) return 'unhealthy';
    if (failureRate > 0.05) return 'degraded';
    if (metrics.avgLatency > 10000) return 'degraded';
    
    return 'healthy';
  }
}

// Export singleton instance
export const emailMonitoringService = new EmailMonitoringService();
