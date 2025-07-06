/**
 * Health Check Service
 * 
 * Comprehensive health monitoring for all system components
 */

import { Pool } from 'pg';
import Redis from 'ioredis';
import { createLogger } from '../utils/observableLogger';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { emailProviderService } from './emailProviderService';

const logger = createLogger('health');
const tracer = trace.getTracer('emc2-core');

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  checks: {
    [key: string]: ComponentHealth;
  };
}

export interface ComponentHealth {
  status: 'up' | 'down' | 'degraded';
  latency?: number;
  message?: string;
  metadata?: Record<string, any>;
}

export class HealthService {
  private startTime: number;
  private checks: Map<string, () => Promise<ComponentHealth>> = new Map();

  constructor(
    private db: Pool,
    private redis?: Redis
  ) {
    this.startTime = Date.now();
    this.registerDefaultChecks();
  }

  /**
   * Register default health checks
   */
  private registerDefaultChecks(): void {
    // Database check
    this.registerCheck('database', async () => this.checkDatabase());
    
    // Redis check
    if (this.redis) {
      this.registerCheck('redis', async () => this.checkRedis());
    }
    
    // Email service check
    this.registerCheck('email', async () => this.checkEmailService());
    
    // Disk space check
    this.registerCheck('disk', async () => this.checkDiskSpace());
    
    // Memory check
    this.registerCheck('memory', async () => this.checkMemory());
  }

  /**
   * Register a custom health check
   */
  registerCheck(name: string, check: () => Promise<ComponentHealth>): void {
    this.checks.set(name, check);
    logger.info(`Registered health check: ${name}`);
  }

  /**
   * Run all health checks
   */
  async checkHealth(): Promise<HealthCheckResult> {
    return tracer.startActiveSpan('health.check', async (span) => {
      try {
        const results: { [key: string]: ComponentHealth } = {};
        const promises: Promise<void>[] = [];

        // Run all checks in parallel
        for (const [name, check] of this.checks) {
          promises.push(
            this.runCheck(name, check)
              .then(result => { results[name] = result; })
              .catch(error => {
                logger.error(`Health check failed: ${name}`, error);
                results[name] = {
                  status: 'down',
                  message: error.message
                };
              })
          );
        }

        await Promise.all(promises);

        // Calculate overall status
        const status = this.calculateOverallStatus(results);
        
        span.setAttributes({
          'health.status': status,
          'health.checks.count': Object.keys(results).length
        });

        if (status !== 'healthy') {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: `Health check ${status}`
          });
        }

        return {
          status,
          timestamp: new Date().toISOString(),
          uptime: Math.floor((Date.now() - this.startTime) / 1000),
          version: process.env.npm_package_version || '0.0.1',
          environment: process.env.NODE_ENV || 'development',
          checks: results
        };
      } finally {
        span.end();
      }
    });
  }

  /**
   * Run a single health check with timeout
   */
  private async runCheck(
    _name: string,
    check: () => Promise<ComponentHealth>
  ): Promise<ComponentHealth> {
    const timeout = 5000; // 5 second timeout
    const startTime = Date.now();

    try {
      const result = await Promise.race([
        check(),
        new Promise<ComponentHealth>((_, reject) => 
          setTimeout(() => reject(new Error('Health check timeout')), timeout)
        )
      ]);

      result.latency = Date.now() - startTime;
      return result;
    } catch (error) {
      return {
        status: 'down',
        latency: Date.now() - startTime,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Calculate overall health status
   */
  private calculateOverallStatus(
    checks: { [key: string]: ComponentHealth }
  ): 'healthy' | 'degraded' | 'unhealthy' {
    const statuses = Object.values(checks).map(c => c.status);
    
    if (statuses.every(s => s === 'up')) {
      return 'healthy';
    }
    
    // Critical services that must be up
    const critical = ['database'];
    const criticalDown = critical.some(
      name => checks[name]?.status === 'down'
    );
    
    if (criticalDown) {
      return 'unhealthy';
    }
    
    if (statuses.some(s => s === 'down' || s === 'degraded')) {
      return 'degraded';
    }
    
    return 'healthy';
  }

  /**
   * Database health check
   */
  private async checkDatabase(): Promise<ComponentHealth> {
    try {
      const start = Date.now();
      const result = await this.db.query('SELECT 1 as health');
      const latency = Date.now() - start;

      return {
        status: 'up',
        latency,
        metadata: {
          rowCount: result.rowCount,
          avgLatency: latency
        }
      };
    } catch (error) {
      return {
        status: 'down',
        message: error instanceof Error ? error.message : 'Database check failed'
      };
    }
  }

  /**
   * Redis health check
   */
  private async checkRedis(): Promise<ComponentHealth> {
    if (!this.redis) {
      return {
        status: 'down',
        message: 'Redis not configured'
      };
    }

    try {
      const start = Date.now();
      await this.redis.ping();
      const latency = Date.now() - start;

      const info = await this.redis.info();
      const memoryUsed = info.match(/used_memory_human:(.+)/)?.[1];

      return {
        status: 'up',
        latency,
        metadata: {
          memoryUsed,
          connected: this.redis.status === 'ready'
        }
      };
    } catch (error) {
      return {
        status: 'down',
        message: error instanceof Error ? error.message : 'Redis check failed'
      };
    }
  }

  /**
   * Email service health check
   */
  private async checkEmailService(): Promise<ComponentHealth> {
    try {
      const providerStatus = emailProviderService.getProviderStatus();
      
      if (providerStatus.healthyProviders === 0) {
        return {
          status: 'down',
          message: 'No healthy email providers'
        };
      }

      const healthPercentage = 
        (providerStatus.healthyProviders / providerStatus.totalProviders) * 100;

      return {
        status: healthPercentage >= 50 ? 'up' : 'degraded',
        metadata: {
          activeProvider: providerStatus.activeProvider,
          healthyProviders: providerStatus.healthyProviders,
          totalProviders: providerStatus.totalProviders,
          providers: providerStatus.providers
        }
      };
    } catch (error) {
      return {
        status: 'down',
        message: error instanceof Error ? error.message : 'Email service check failed'
      };
    }
  }

  /**
   * Disk space health check
   */
  private async checkDiskSpace(): Promise<ComponentHealth> {
    try {
      const os = require('os');
      const checkDiskSpace = require('check-disk-space').default;
      
      const diskPath = os.platform() === 'win32' ? 'C:' : '/';
      const diskSpace = await checkDiskSpace(diskPath);
      
      const usedPercentage = 
        ((diskSpace.size - diskSpace.free) / diskSpace.size) * 100;

      return {
        status: usedPercentage > 90 ? 'degraded' : 'up',
        metadata: {
          total: Math.round(diskSpace.size / 1024 / 1024 / 1024) + ' GB',
          free: Math.round(diskSpace.free / 1024 / 1024 / 1024) + ' GB',
          used: Math.round(usedPercentage) + '%'
        }
      };
    } catch (error) {
      // Not critical, just log
      return {
        status: 'up',
        message: 'Disk check not available'
      };
    }
  }

  /**
   * Memory health check
   */
  private async checkMemory(): Promise<ComponentHealth> {
    const used = process.memoryUsage();
    const totalMem = require('os').totalmem();
    const freeMem = require('os').freemem();
    
    const systemUsedPercentage = ((totalMem - freeMem) / totalMem) * 100;
    const heapUsedPercentage = (used.heapUsed / used.heapTotal) * 100;

    return {
      status: heapUsedPercentage > 90 || systemUsedPercentage > 90 ? 'degraded' : 'up',
      metadata: {
        process: {
          rss: Math.round(used.rss / 1024 / 1024) + ' MB',
          heapTotal: Math.round(used.heapTotal / 1024 / 1024) + ' MB',
          heapUsed: Math.round(used.heapUsed / 1024 / 1024) + ' MB',
          heapUsedPercentage: Math.round(heapUsedPercentage) + '%'
        },
        system: {
          total: Math.round(totalMem / 1024 / 1024) + ' MB',
          free: Math.round(freeMem / 1024 / 1024) + ' MB',
          usedPercentage: Math.round(systemUsedPercentage) + '%'
        }
      }
    };
  }

  /**
   * Get liveness status (is the service alive?)
   */
  async getLiveness(): Promise<{ status: 'ok' | 'error' }> {
    // Simple check - can we allocate memory and respond?
    try {
      Buffer.alloc(1024); // Allocate 1KB
      return { status: 'ok' };
    } catch {
      return { status: 'error' };
    }
  }

  /**
   * Get readiness status (is the service ready to accept traffic?)
   */
  async getReadiness(): Promise<{ 
    status: 'ready' | 'not_ready';
    checks: { [key: string]: boolean };
  }> {
    const checks: { [key: string]: boolean } = {};
    
    // Check critical dependencies
    try {
      await this.db.query('SELECT 1');
      checks.database = true;
    } catch {
      checks.database = false;
    }

    const isReady = checks.database; // Database is critical
    
    return {
      status: isReady ? 'ready' : 'not_ready',
      checks
    };
  }
}

// Export singleton instance
let healthServiceInstance: HealthService | null = null;

export function initializeHealthService(db: Pool, redis?: Redis): HealthService {
  if (!healthServiceInstance) {
    healthServiceInstance = new HealthService(db, redis);
  }
  return healthServiceInstance;
}

export function getHealthService(): HealthService {
  if (!healthServiceInstance) {
    throw new Error('Health service not initialized');
  }
  return healthServiceInstance;
}
