/**
 * Email Provider Service
 * 
 * Manages multiple email providers with automatic fallback
 */

import nodemailer, { Transporter } from 'nodemailer';
import sgMail from '@sendgrid/mail';
import Mailgun from 'mailgun.js';
import formData from 'form-data';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { emailConfig } from '../config/email';
import { logger } from '../utils/logger';
import { emailRateLimitService } from './emailRateLimitService';
import { emailMonitoringService } from './emailMonitoringService';

export interface EmailProvider {
  name: string;
  type: 'smtp' | 'api';
  priority: number;
  weight: number;
  enabled: boolean;
  healthScore: number;
  lastUsed?: Date;
  lastError?: Date;
  send: (options: any) => Promise<any>;
}

export class EmailProviderService {
  private providers: Map<string, EmailProvider> = new Map();
  private smtpTransporters: Map<string, Transporter> = new Map();
  private currentProvider: string | null = null;
  private healthCheckInterval: NodeJS.Timer | null = null;

  constructor() {
    this.initializeProviders();
    this.startHealthChecks();
  }

  /**
   * Initialize all email providers
   */
  private async initializeProviders() {
    // Initialize based on environment configuration
    if (process.env.SMTP_HOST) {
      const smtpConfig: any = {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER || '',
          pass: process.env.SMTP_PASS || ''
        }
      };
      
      // Add specific TLS options for Microsoft
      if (process.env.SMTP_HOST.includes('outlook') || process.env.SMTP_HOST.includes('office365')) {
        smtpConfig.tls = {
          ciphers: 'SSLv3',
          rejectUnauthorized: false
        };
      }
      
      await this.initializeSMTPProvider('primary-smtp', smtpConfig, 1, 40);
    }

    // SendGrid
    if (process.env.SENDGRID_API_KEY) {
      this.initializeSendGrid(process.env.SENDGRID_API_KEY, 2, 30);
    }

    // Mailgun
    if (process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN) {
      this.initializeMailgun(
        process.env.MAILGUN_API_KEY,
        process.env.MAILGUN_DOMAIN,
        process.env.MAILGUN_EU === 'true',
        3,
        20
      );
    }

    // AWS SES
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      this.initializeAWSSES(process.env.AWS_REGION || 'us-east-1', 4, 10);
    }

    logger.info(`Initialized ${this.providers.size} email providers`);
  }

  /**
   * Initialize SMTP provider
   */
  private async initializeSMTPProvider(
    name: string,
    config: any,
    priority: number,
    weight: number
  ) {
    try {
      const transporter = nodemailer.createTransporter(config);
      
      // Verify connection
      await transporter.verify();
      
      this.smtpTransporters.set(name, transporter);
      
      this.providers.set(name, {
        name,
        type: 'smtp',
        priority,
        weight,
        enabled: true,
        healthScore: 100,
        send: async (options) => {
          return transporter.sendMail(options);
        }
      });
      
      logger.info(`SMTP provider ${name} initialized successfully`);
    } catch (error) {
      logger.error(`Failed to initialize SMTP provider ${name}:`, error);
    }
  }

  /**
   * Initialize SendGrid
   */
  private initializeSendGrid(apiKey: string, priority: number, weight: number) {
    sgMail.setApiKey(apiKey);
    
    this.providers.set('sendgrid', {
      name: 'sendgrid',
      type: 'api',
      priority,
      weight,
      enabled: true,
      healthScore: 100,
      send: async (options) => {
        const msg = {
          to: options.to,
          from: options.from,
          subject: options.subject,
          text: options.text,
          html: options.html,
          attachments: options.attachments?.map((att: any) => ({
            content: att.content.toString('base64'),
            filename: att.filename,
            type: att.contentType,
            disposition: 'attachment'
          }))
        };
        
        return sgMail.send(msg);
      }
    });
    
    logger.info('SendGrid provider initialized');
  }

  /**
   * Initialize Mailgun
   */
  private initializeMailgun(
    apiKey: string,
    domain: string,
    eu: boolean,
    priority: number,
    weight: number
  ) {
    const mailgun = new Mailgun(formData);
    const client = mailgun.client({
      username: 'api',
      key: apiKey,
      url: eu ? 'https://api.eu.mailgun.net' : 'https://api.mailgun.net'
    });
    
    this.providers.set('mailgun', {
      name: 'mailgun',
      type: 'api',
      priority,
      weight,
      enabled: true,
      healthScore: 100,
      send: async (options) => {
        const data = {
          from: options.from,
          to: Array.isArray(options.to) ? options.to : [options.to],
          subject: options.subject,
          text: options.text,
          html: options.html,
          attachment: options.attachments
        };
        
        return client.messages.create(domain, data);
      }
    });
    
    logger.info('Mailgun provider initialized');
  }

  /**
   * Initialize AWS SES
   */
  private initializeAWSSES(region: string, priority: number, weight: number) {
    const client = new SESClient({ region });
    
    this.providers.set('aws-ses', {
      name: 'aws-ses',
      type: 'api',
      priority,
      weight,
      enabled: true,
      healthScore: 100,
      send: async (options) => {
        const params = {
          Source: options.from,
          Destination: {
            ToAddresses: Array.isArray(options.to) ? options.to : [options.to],
            CcAddresses: options.cc ? (Array.isArray(options.cc) ? options.cc : [options.cc]) : undefined,
            BccAddresses: options.bcc ? (Array.isArray(options.bcc) ? options.bcc : [options.bcc]) : undefined
          },
          Message: {
            Subject: { Data: options.subject },
            Body: {
              Text: options.text ? { Data: options.text } : undefined,
              Html: options.html ? { Data: options.html } : undefined
            }
          }
        };
        
        const command = new SendEmailCommand(params);
        return client.send(command);
      }
    });
    
    logger.info('AWS SES provider initialized');
  }

  /**
   * Send email with automatic provider selection and fallback
   */
  async sendEmail(options: any): Promise<{
    success: boolean;
    provider: string;
    messageId?: string;
    error?: Error;
    attempts: Array<{ provider: string; error?: string }>;
  }> {
    const attempts: Array<{ provider: string; error?: string }> = [];
    const startTime = Date.now();
    
    // Get sorted providers
    const availableProviders = this.getAvailableProviders();
    
    if (availableProviders.length === 0) {
      throw new Error('No email providers available');
    }
    
    for (const provider of availableProviders) {
      const providerStartTime = Date.now();
      
      try {
        // Check rate limits
        const rateLimitCheck = await emailRateLimitService.canSendEmail(
          provider.name,
          options.to
        );
        
        if (!rateLimitCheck.allowed) {
          attempts.push({
            provider: provider.name,
            error: rateLimitCheck.reason
          });
          continue;
        }
        
        // Increment concurrent connections
        emailRateLimitService.incrementConcurrent(provider.name);
        
        try {
          // Send email
          const result = await provider.send(options);
          
          // Consume rate limit
          await emailRateLimitService.consumeRateLimit(provider.name, options.to);
          
          // Record success
          const duration = Date.now() - providerStartTime;
          emailMonitoringService.recordEmailSent(
            provider.name,
            options.template || 'custom',
            duration
          );
          
          // Update provider health
          this.updateProviderHealth(provider.name, true);
          
          return {
            success: true,
            provider: provider.name,
            messageId: result.messageId || result.id,
            attempts
          };
        } finally {
          // Decrement concurrent connections
          emailRateLimitService.decrementConcurrent(provider.name);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        attempts.push({
          provider: provider.name,
          error: errorMessage
        });
        
        // Record failure
        emailMonitoringService.recordEmailFailed(
          provider.name,
          this.classifyError(error),
          error as Error
        );
        
        // Update provider health
        this.updateProviderHealth(provider.name, false, error as Error);
        
        logger.warn(`Provider ${provider.name} failed:`, errorMessage);
        
        // Continue to next provider
        continue;
      }
    }
    
    // All providers failed
    const totalDuration = Date.now() - startTime;
    logger.error('All email providers failed', { attempts, duration: totalDuration });
    
    return {
      success: false,
      provider: 'none',
      error: new Error('All email providers failed'),
      attempts
    };
  }

  /**
   * Get available providers sorted by priority and health
   */
  private getAvailableProviders(): EmailProvider[] {
    const providers = Array.from(this.providers.values())
      .filter(p => p.enabled && p.healthScore > 0)
      .sort((a, b) => {
        // First sort by priority
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        
        // Then by health score
        if (a.healthScore !== b.healthScore) {
          return b.healthScore - a.healthScore;
        }
        
        // Finally by weight (for load balancing)
        return b.weight - a.weight;
      });
    
    // Apply weighted random selection for providers with same priority
    return this.applyWeightedSelection(providers);
  }

  /**
   * Apply weighted random selection
   */
  private applyWeightedSelection(providers: EmailProvider[]): EmailProvider[] {
    const grouped = new Map<number, EmailProvider[]>();
    
    // Group by priority
    providers.forEach(p => {
      const group = grouped.get(p.priority) || [];
      group.push(p);
      grouped.set(p.priority, group);
    });
    
    // Apply weighted selection within each group
    const result: EmailProvider[] = [];
    
    for (const [priority, group] of grouped) {
      if (group.length === 1) {
        result.push(group[0]);
      } else {
        // Weighted random selection
        const sorted = this.weightedShuffle(group);
        result.push(...sorted);
      }
    }
    
    return result;
  }

  /**
   * Weighted shuffle
   */
  private weightedShuffle(providers: EmailProvider[]): EmailProvider[] {
    const weighted: Array<{ provider: EmailProvider; score: number }> = providers.map(p => ({
      provider: p,
      score: Math.random() * p.weight * (p.healthScore / 100)
    }));
    
    return weighted
      .sort((a, b) => b.score - a.score)
      .map(w => w.provider);
  }

  /**
   * Update provider health score
   */
  private updateProviderHealth(
    providerName: string,
    success: boolean,
    error?: Error
  ) {
    const provider = this.providers.get(providerName);
    if (!provider) return;
    
    if (success) {
      // Increase health score
      provider.healthScore = Math.min(100, provider.healthScore + 5);
      provider.lastUsed = new Date();
    } else {
      // Decrease health score
      provider.healthScore = Math.max(0, provider.healthScore - 20);
      provider.lastError = new Date();
      
      // Disable provider if health is too low
      if (provider.healthScore === 0) {
        provider.enabled = false;
        logger.error(`Provider ${providerName} disabled due to low health score`);
      }
    }
  }

  /**
   * Classify error type
   */
  private classifyError(error: any): string {
    const message = error?.message?.toLowerCase() || '';
    
    if (message.includes('auth') || message.includes('credential')) {
      return 'authentication';
    }
    if (message.includes('rate') || message.includes('limit')) {
      return 'rate_limit';
    }
    if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
      return 'timeout';
    }
    if (message.includes('network') || message.includes('ECONNREFUSED')) {
      return 'network';
    }
    if (message.includes('invalid') || message.includes('recipient')) {
      return 'invalid_recipient';
    }
    
    return 'unknown';
  }

  /**
   * Start health check monitoring
   */
  private startHealthChecks() {
    // Run health checks every 5 minutes
    this.healthCheckInterval = setInterval(() => {
      this.runHealthChecks();
    }, 300000);
  }

  /**
   * Run health checks on all providers
   */
  private async runHealthChecks() {
    for (const [name, provider] of this.providers) {
      if (!provider.enabled && provider.healthScore === 0) {
        // Try to re-enable disabled providers
        const hoursSinceError = provider.lastError
          ? (Date.now() - provider.lastError.getTime()) / 3600000
          : 24;
        
        if (hoursSinceError > 1) {
          provider.enabled = true;
          provider.healthScore = 50;
          logger.info(`Re-enabling provider ${name} for health check`);
        }
      }
      
      // Gradually increase health score for unused providers
      if (provider.enabled && provider.healthScore < 100) {
        const hoursSinceUse = provider.lastUsed
          ? (Date.now() - provider.lastUsed.getTime()) / 3600000
          : 0;
        
        if (hoursSinceUse > 0.5) {
          provider.healthScore = Math.min(100, provider.healthScore + 10);
        }
      }
    }
  }

  /**
   * Get provider status
   */
  getProviderStatus() {
    const providers = Array.from(this.providers.values()).map(p => ({
      name: p.name,
      type: p.type,
      priority: p.priority,
      weight: p.weight,
      enabled: p.enabled,
      healthScore: p.healthScore,
      lastUsed: p.lastUsed,
      lastError: p.lastError
    }));
    
    return {
      providers,
      activeProvider: this.currentProvider,
      healthyProviders: providers.filter(p => p.enabled && p.healthScore > 50).length,
      totalProviders: providers.length
    };
  }

  /**
   * Manually switch provider
   */
  switchProvider(providerName: string) {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Provider ${providerName} not found`);
    }
    
    if (!provider.enabled) {
      throw new Error(`Provider ${providerName} is disabled`);
    }
    
    this.currentProvider = providerName;
    logger.info(`Manually switched to provider ${providerName}`);
  }

  /**
   * Stop health checks
   */
  stop() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    // Close SMTP connections
    for (const transporter of this.smtpTransporters.values()) {
      transporter.close();
    }
  }
}

// Export singleton instance
export const emailProviderService = new EmailProviderService();
