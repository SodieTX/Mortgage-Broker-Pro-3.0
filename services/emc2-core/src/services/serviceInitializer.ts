/**
 * Service Initializer
 * 
 * Manages the initialization order of services to avoid circular dependencies
 * and provides lazy initialization for better performance
 */

import { logger } from '../utils/logger';

export class ServiceInitializer {
  private static initialized = false;
  private static initPromise: Promise<void> | null = null;

  /**
   * Initialize all services in the correct order
   */
  static async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._initialize();
    await this.initPromise;
    this.initialized = true;
  }

  private static async _initialize(): Promise<void> {
    logger.info('Starting service initialization...');

    try {
      // Initialize services in dependency order
      // These imports are done dynamically to avoid circular dependencies during module loading
      
      // 1. Initialize basic services first (no dependencies)
      // These are loaded but not used directly - they're dependencies of other services
      await import('./emailRateLimitService');
      await import('./emailPreferencesService');
      await import('./emailTrackingService');
      
      logger.info('Basic services loaded');

      // 2. Initialize monitoring service (depends on queue service, but we'll delay that)
      const { emailMonitoringService } = await import('./emailMonitoringService');
      // Don't start monitoring yet
      
      logger.info('Monitoring service loaded');

      // 3. Initialize provider service (depends on rate limit and monitoring)
      const { emailProviderService } = await import('./emailProviderService');
      await emailProviderService.initialize();
      
      logger.info('Provider service initialized');

      // 4. Initialize email service (depends on provider, tracking, preferences)
      const { emailService } = await import('./emailService');
      await emailService.initialize();
      
      logger.info('Email service initialized');

      // 5. Initialize queue service (depends on email service)
      const { emailQueueService } = await import('./emailQueueService');
      await emailQueueService.initialize();
      
      logger.info('Queue service initialized');

      // 6. Now start monitoring (which depends on queue service)
      emailMonitoringService.initialize();
      
      logger.info('All services initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize services:', error);
      throw error;
    }
  }

  /**
   * Check if services are initialized
   */
  static isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Reset initialization (mainly for testing)
   */
  static reset(): void {
    this.initialized = false;
    this.initPromise = null;
  }
}
