/**
 * Email Rate Limiting Service
 * 
 * Prevents SMTP server blocking through intelligent rate limiting
 */

import { RateLimiterRedis, RateLimiterMemory, IRateLimiterOptions, RateLimiterRes } from 'rate-limiter-flexible';
import Redis from 'ioredis';
import { emailConfig } from '../config/email';
import { logger } from '../utils/logger';

export interface RateLimitConfig {
  provider: string;
  limits: {
    perSecond?: number;
    perMinute?: number;
    perHour?: number;
    perDay?: number;
    concurrent?: number;
  };
  burst?: {
    tokens: number;
    interval: number;
  };
}

export class EmailRateLimitService {
  private limiters: Map<string, any> = new Map();
  private redis: Redis | null = null;
  private providerConfigs: Map<string, RateLimitConfig> = new Map();
  private concurrentConnections: Map<string, number> = new Map();

  constructor() {
    this.initializeProviderConfigs();
    this.initializeRateLimiters();
  }

  /**
   * Initialize provider-specific rate limit configurations
   */
  private initializeProviderConfigs() {
    // Gmail/Google Workspace limits
    this.providerConfigs.set('gmail', {
      provider: 'gmail',
      limits: {
        perSecond: 1,
        perMinute: 20,
        perHour: 500,
        perDay: 2000,
        concurrent: 10
      },
      burst: {
        tokens: 5,
        interval: 60
      }
    });

    // SendGrid limits (free tier)
    this.providerConfigs.set('sendgrid', {
      provider: 'sendgrid',
      limits: {
        perSecond: 3,
        perMinute: 100,
        perHour: 1000,
        perDay: 100,
        concurrent: 20
      }
    });

    // Mailgun limits
    this.providerConfigs.set('mailgun', {
      provider: 'mailgun',
      limits: {
        perSecond: 5,
        perMinute: 300,
        perHour: 10000,
        perDay: 100000,
        concurrent: 50
      }
    });

    // AWS SES limits (sandbox)
    this.providerConfigs.set('aws-ses', {
      provider: 'aws-ses',
      limits: {
        perSecond: 1,
        perMinute: 60,
        perHour: 1000,
        perDay: 10000,
        concurrent: 25
      }
    });

    // Default limits for unknown providers
    this.providerConfigs.set('default', {
      provider: 'default',
      limits: {
        perSecond: 1,
        perMinute: 30,
        perHour: 500,
        perDay: 5000,
        concurrent: 10
      }
    });
  }

  /**
   * Initialize rate limiters for each provider
   */
  private async initializeRateLimiters() {
    try {
      // Try to connect to Redis
      this.redis = new Redis({
        host: emailConfig.queue.redis.host,
        port: emailConfig.queue.redis.port,
        password: emailConfig.queue.redis.password
      });

      await this.redis.ping();
      logger.info('Rate limiter connected to Redis');
    } catch (error) {
      logger.warn('Rate limiter falling back to memory storage:', error);
      this.redis = null;
    }

    // Create rate limiters for each provider
    for (const [provider, config] of this.providerConfigs) {
      this.createLimitersForProvider(provider, config);
    }
  }

  /**
   * Create rate limiters for a specific provider
   */
  private createLimitersForProvider(provider: string, config: RateLimitConfig) {
    const limiters: any = {};

    // Per-second limiter
    if (config.limits.perSecond) {
      limiters.perSecond = this.createLimiter(`${provider}:second`, {
        points: config.limits.perSecond,
        duration: 1,
        blockDuration: 1
      });
    }

    // Per-minute limiter
    if (config.limits.perMinute) {
      limiters.perMinute = this.createLimiter(`${provider}:minute`, {
        points: config.limits.perMinute,
        duration: 60,
        blockDuration: 60
      });
    }

    // Per-hour limiter
    if (config.limits.perHour) {
      limiters.perHour = this.createLimiter(`${provider}:hour`, {
        points: config.limits.perHour,
        duration: 3600,
        blockDuration: 3600
      });
    }

    // Per-day limiter
    if (config.limits.perDay) {
      limiters.perDay = this.createLimiter(`${provider}:day`, {
        points: config.limits.perDay,
        duration: 86400,
        blockDuration: 86400
      });
    }

    // Burst limiter (token bucket)
    if (config.burst) {
      limiters.burst = this.createLimiter(`${provider}:burst`, {
        points: config.burst.tokens,
        duration: config.burst.interval,
        blockDuration: config.burst.interval
      });
    }

    this.limiters.set(provider, limiters);
  }

  /**
   * Create a single rate limiter
   */
  private createLimiter(keyPrefix: string, options: IRateLimiterOptions) {
    const baseOptions = {
      keyPrefix,
      ...options
    };

    if (this.redis) {
      return new RateLimiterRedis({
        storeClient: this.redis,
        ...baseOptions
      });
    } else {
      return new RateLimiterMemory(baseOptions);
    }
  }

  /**
   * Check if email can be sent based on rate limits
   */
  async canSendEmail(provider: string, recipient?: string): Promise<{
    allowed: boolean;
    retryAfter?: number;
    reason?: string;
  }> {
    const normalizedProvider = this.normalizeProvider(provider);
    const limiters = this.limiters.get(normalizedProvider);
    
    if (!limiters) {
      return { allowed: true };
    }

    const config = this.providerConfigs.get(normalizedProvider)!;
    const key = recipient || 'global';

    try {
      // Check concurrent connections
      const currentConnections = this.concurrentConnections.get(normalizedProvider) || 0;
      if (config.limits.concurrent && currentConnections >= config.limits.concurrent) {
        return {
          allowed: false,
          retryAfter: 1000,
          reason: 'Too many concurrent connections'
        };
      }

      // Check all rate limits
      const checks = [];
      
      if (limiters.perSecond) {
        checks.push(this.checkLimit(limiters.perSecond, key, 'per second'));
      }
      
      if (limiters.perMinute) {
        checks.push(this.checkLimit(limiters.perMinute, key, 'per minute'));
      }
      
      if (limiters.perHour) {
        checks.push(this.checkLimit(limiters.perHour, key, 'per hour'));
      }
      
      if (limiters.perDay) {
        checks.push(this.checkLimit(limiters.perDay, key, 'per day'));
      }

      const results = await Promise.all(checks);
      const blocked = results.find(r => !r.allowed);
      
      if (blocked) {
        return blocked;
      }

      // Check burst if available
      if (limiters.burst) {
        try {
          await limiters.burst.consume(key);
        } catch (rateLimiterRes) {
          // Burst limit exceeded, but we can still send at normal rate
          logger.debug(`Burst limit exceeded for ${provider}, falling back to normal rate`);
        }
      }

      return { allowed: true };
    } catch (error) {
      logger.error('Rate limit check failed:', error);
      // Fail open - allow email on error
      return { allowed: true };
    }
  }

  /**
   * Check a single rate limit
   */
  private async checkLimit(
    limiter: any,
    key: string,
    limitType: string
  ): Promise<{ allowed: boolean; retryAfter?: number; reason?: string }> {
    try {
      await limiter.consume(key, 0); // Check without consuming
      return { allowed: true };
    } catch (rateLimiterRes) {
      if (rateLimiterRes instanceof RateLimiterRes) {
        return {
          allowed: false,
          retryAfter: Math.round(rateLimiterRes.msBeforeNext),
          reason: `Rate limit exceeded (${limitType})`
        };
      }
      throw rateLimiterRes;
    }
  }

  /**
   * Consume rate limit tokens
   */
  async consumeRateLimit(provider: string, recipient?: string): Promise<void> {
    const normalizedProvider = this.normalizeProvider(provider);
    const limiters = this.limiters.get(normalizedProvider);
    
    if (!limiters) {
      return;
    }

    const key = recipient || 'global';

    // Consume from all limiters
    const consumes = [];
    
    if (limiters.perSecond) {
      consumes.push(limiters.perSecond.consume(key));
    }
    
    if (limiters.perMinute) {
      consumes.push(limiters.perMinute.consume(key));
    }
    
    if (limiters.perHour) {
      consumes.push(limiters.perHour.consume(key));
    }
    
    if (limiters.perDay) {
      consumes.push(limiters.perDay.consume(key));
    }

    try {
      await Promise.all(consumes);
    } catch (error) {
      logger.error('Failed to consume rate limit:', error);
      throw new Error('Rate limit exceeded');
    }
  }

  /**
   * Increment concurrent connections
   */
  incrementConcurrent(provider: string): void {
    const normalizedProvider = this.normalizeProvider(provider);
    const current = this.concurrentConnections.get(normalizedProvider) || 0;
    this.concurrentConnections.set(normalizedProvider, current + 1);
  }

  /**
   * Decrement concurrent connections
   */
  decrementConcurrent(provider: string): void {
    const normalizedProvider = this.normalizeProvider(provider);
    const current = this.concurrentConnections.get(normalizedProvider) || 0;
    this.concurrentConnections.set(normalizedProvider, Math.max(0, current - 1));
  }

  /**
   * Get current rate limit status
   */
  async getRateLimitStatus(provider: string): Promise<any> {
    const normalizedProvider = this.normalizeProvider(provider);
    const limiters = this.limiters.get(normalizedProvider);
    const config = this.providerConfigs.get(normalizedProvider);
    
    if (!limiters || !config) {
      return null;
    }

    const status: any = {
      provider: normalizedProvider,
      limits: config.limits,
      current: {
        concurrent: this.concurrentConnections.get(normalizedProvider) || 0
      },
      remaining: {}
    };

    const key = 'global';

    try {
      if (limiters.perSecond) {
        const res = await limiters.perSecond.get(key);
        status.remaining.perSecond = config.limits.perSecond! - (res?.consumedPoints || 0);
      }
      
      if (limiters.perMinute) {
        const res = await limiters.perMinute.get(key);
        status.remaining.perMinute = config.limits.perMinute! - (res?.consumedPoints || 0);
      }
      
      if (limiters.perHour) {
        const res = await limiters.perHour.get(key);
        status.remaining.perHour = config.limits.perHour! - (res?.consumedPoints || 0);
      }
      
      if (limiters.perDay) {
        const res = await limiters.perDay.get(key);
        status.remaining.perDay = config.limits.perDay! - (res?.consumedPoints || 0);
      }
    } catch (error) {
      logger.error('Failed to get rate limit status:', error);
    }

    return status;
  }

  /**
   * Reset rate limits for a provider
   */
  async resetRateLimits(provider: string, limitType?: string): Promise<void> {
    const normalizedProvider = this.normalizeProvider(provider);
    const limiters = this.limiters.get(normalizedProvider);
    
    if (!limiters) {
      return;
    }

    const key = 'global';

    try {
      if (!limitType || limitType === 'perSecond') {
        await limiters.perSecond?.delete(key);
      }
      
      if (!limitType || limitType === 'perMinute') {
        await limiters.perMinute?.delete(key);
      }
      
      if (!limitType || limitType === 'perHour') {
        await limiters.perHour?.delete(key);
      }
      
      if (!limitType || limitType === 'perDay') {
        await limiters.perDay?.delete(key);
      }
      
      if (!limitType || limitType === 'burst') {
        await limiters.burst?.delete(key);
      }

      logger.info(`Reset rate limits for ${provider}${limitType ? ` (${limitType})` : ''}`);
    } catch (error) {
      logger.error('Failed to reset rate limits:', error);
    }
  }

  /**
   * Update rate limits for a provider
   */
  updateProviderLimits(provider: string, limits: Partial<RateLimitConfig['limits']>): void {
    const normalizedProvider = this.normalizeProvider(provider);
    const config = this.providerConfigs.get(normalizedProvider);
    
    if (!config) {
      return;
    }

    // Update configuration
    config.limits = { ...config.limits, ...limits };
    this.providerConfigs.set(normalizedProvider, config);

    // Recreate limiters
    this.createLimitersForProvider(normalizedProvider, config);
    
    logger.info(`Updated rate limits for ${provider}:`, limits);
  }

  /**
   * Normalize provider name
   */
  private normalizeProvider(provider: string): string {
    const normalized = provider.toLowerCase().replace(/[^a-z0-9-]/g, '');
    return this.providerConfigs.has(normalized) ? normalized : 'default';
  }

  /**
   * Get optimal send time based on rate limits
   */
  async getOptimalSendTime(provider: string): Promise<Date> {
    const status = await this.getRateLimitStatus(provider);
    
    if (!status) {
      return new Date();
    }

    // Find the most restrictive limit
    let delayMs = 0;
    
    if (status.remaining.perSecond <= 0) {
      delayMs = Math.max(delayMs, 1000);
    }
    
    if (status.remaining.perMinute <= 0) {
      delayMs = Math.max(delayMs, 60000);
    }
    
    if (status.remaining.perHour <= 0) {
      delayMs = Math.max(delayMs, 3600000);
    }

    return new Date(Date.now() + delayMs);
  }
}

// Export singleton instance
export const emailRateLimitService = new EmailRateLimitService();
