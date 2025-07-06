/**
 * Email Service
 * 
 * Handles all email functionality including SMTP, templates, and queuing
 */

import nodemailer, { Transporter } from 'nodemailer';
import handlebars from 'handlebars';
import fs from 'fs/promises';
import path from 'path';
import { emailConfig, validateEmailConfig } from '../config/email';
import { logger } from '../utils/logger';
import { emailProviderService } from './emailProviderService';
import { emailTrackingService } from './emailTrackingService';
import { emailPreferencesService } from './emailPreferencesService';
import { v4 as uuidv4 } from 'uuid';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  template?: string;
  templateData?: Record<string, any>;
  html?: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content?: Buffer | string;
    path?: string;
    contentType?: string;
  }>;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  headers?: Record<string, string>;
}

export interface BulkEmailOptions {
  recipients: Array<{
    email: string;
    data?: Record<string, any>;
  }>;
  subject: string;
  template: string;
  baseData?: Record<string, any>;
  schedule?: Date;
  batchSize?: number;
  delayBetweenBatches?: number;
}

export class EmailService {
  private transporter: Transporter | null = null;
  private templates: Map<string, handlebars.TemplateDelegate> = new Map();
  private isInitialized = false;

  constructor() {
    // Initialize on first use
  }

  /**
   * Initialize the email service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Validate configuration
      const validation = validateEmailConfig();
      if (!validation.isValid) {
        logger.warn('Email configuration incomplete:', validation.errors);
        // Continue initialization but log warning
      }

      // Create transporter
      this.transporter = nodemailer.createTransport({
        host: emailConfig.smtp.host,
        port: emailConfig.smtp.port,
        secure: emailConfig.smtp.secure,
        auth: emailConfig.smtp.auth,
        tls: emailConfig.smtp.tls
      });

      // Verify connection
      if (emailConfig.smtp.auth.user && emailConfig.smtp.auth.pass) {
        await this.transporter!.verify();
        logger.info('Email service connected successfully');
      } else {
        logger.warn('Email service initialized without credentials - emails will not be sent');
      }

      // Load email templates
      await this.loadTemplates();

      this.isInitialized = true;
    } catch (error) {
      logger.error('Failed to initialize email service:', error);
      // Don't throw - allow service to run without email
    }
  }

  /**
   * Load email templates from file system
   */
  private async loadTemplates(): Promise<void> {
    try {
      const templateDir = path.join(process.cwd(), emailConfig.templates.path);
      
      // Create template directory if it doesn't exist
      try {
        await fs.mkdir(templateDir, { recursive: true });
      } catch (err) {
        // Directory might already exist
      }

      // Load all .hbs files
      const files = await fs.readdir(templateDir);
      const templateFiles = files.filter(f => f.endsWith('.hbs'));

      for (const file of templateFiles) {
        const name = path.basename(file, '.hbs');
        const content = await fs.readFile(path.join(templateDir, file), 'utf-8');
        this.templates.set(name, handlebars.compile(content));
      }

      logger.info(`Loaded ${this.templates.size} email templates`);
    } catch (error) {
      logger.warn('Failed to load email templates:', error);
    }
  }

  /**
   * Send a single email
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    await this.initialize();

    const emailId = uuidv4();
    const recipient = Array.isArray(options.to) ? options.to[0] : options.to;
    
    // Check if we can send this email
    const emailType = this.getEmailType(options.template);
    const canSend = await emailPreferencesService.canSendEmail(recipient, emailType);
    
    if (!canSend.allowed) {
      logger.info(`Email blocked for ${recipient}: ${canSend.reason}`);
      return false;
    }
    
    try {
      // Build email content
      let html = options.html;
      let text = options.text;

      if (options.template && options.templateData) {
        const template = this.templates.get(options.template);
        if (template) {
          // Add default template data
          const templateData = {
            ...options.templateData,
            year: new Date().getFullYear(),
            appUrl: process.env.APP_URL,
            email: recipient
          };
          
          html = template(templateData);
          
          // Generate text version from HTML if not provided
          if (!text) {
            text = this.htmlToText(html);
          }
        } else {
          logger.warn(`Email template '${options.template}' not found`);
        }
      }
      
      // Add tracking pixel to HTML emails
      if (html && options.template !== 'test') {
        const trackingPixel = emailTrackingService.generateTrackingPixel(emailId);
        html = html.replace('</body>', `${trackingPixel}</body>`);
        
        // Wrap links with tracking
        html = this.wrapLinksWithTracking(html, emailId);
      }

      // Prepare email options
      const emailData = {
        from: emailConfig.defaults.from,
        replyTo: options.replyTo || emailConfig.defaults.replyTo,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        cc: options.cc ? (Array.isArray(options.cc) ? options.cc.join(', ') : options.cc) : undefined,
        bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc) : undefined,
        subject: options.subject,
        text,
        html,
        attachments: options.attachments,
        headers: {
          ...options.headers,
          'X-Email-Id': emailId
        }
      };
      
      // Track email sent
      emailTrackingService.trackEmailSent(
        emailId,
        recipient,
        options.template || 'custom',
        options.subject
      );

      // Send through provider service with fallback
      const result = await emailProviderService.sendEmail(emailData);
      
      if (!result.success) {
        throw result.error || new Error('Failed to send email');
      }
      
      logger.info(`Email sent successfully via ${result.provider}: ${emailId}`);
      return true;
    } catch (error) {
      logger.error('Failed to send email:', error);
      throw error;
    }
  }

  /**
   * Send email with retry logic
   */
  async sendEmailWithRetry(
    options: EmailOptions,
    maxRetries: number = emailConfig.queue.retryAttempts
  ): Promise<boolean> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.sendEmail(options);
      } catch (error) {
        lastError = error as Error;
        logger.warn(`Email send attempt ${attempt} failed:`, error);
        
        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = emailConfig.queue.retryDelay * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Failed to send email after retries');
  }

  /**
   * Queue email for background processing
   */
  async queueEmail(options: EmailOptions, _priority: number = 0): Promise<string> {
    // In a full implementation, this would add to a Bull queue
    // For now, we'll send immediately
    await this.sendEmailWithRetry(options);
    return `email-${Date.now()}`;
  }

  /**
   * Send bulk emails with batching
   */
  async sendBulkEmails(options: BulkEmailOptions): Promise<void> {
    const batchSize = options.batchSize || 50;
    const delayBetweenBatches = options.delayBetweenBatches || 1000;

    const template = this.templates.get(options.template);
    if (!template) {
      throw new Error(`Template '${options.template}' not found`);
    }

    // Process in batches
    for (let i = 0; i < options.recipients.length; i += batchSize) {
      const batch = options.recipients.slice(i, i + batchSize);
      
      // Send emails in parallel within batch
      const promises = batch.map(recipient => {
        const templateData = {
          ...options.baseData,
          ...recipient.data,
          email: recipient.email
        };

        return this.sendEmail({
          to: recipient.email,
          subject: options.subject,
          template: options.template,
          templateData
        }).catch(error => {
          logger.error(`Failed to send email to ${recipient.email}:`, error);
          // Don't throw - continue with other emails
        });
      });

      await Promise.all(promises);

      // Delay between batches (except for last batch)
      if (i + batchSize < options.recipients.length) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
    }
  }

  /**
   * Convert HTML to plain text
   */
  private htmlToText(html: string): string {
    // Simple HTML to text conversion
    return html
      .replace(/<style[^>]*>.*?<\/style>/gs, '')
      .replace(/<script[^>]*>.*?<\/script>/gs, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  /**
   * Wrap links in HTML with tracking
   */
  private wrapLinksWithTracking(html: string, emailId: string): string {
    // Regular expression to find links
    const linkRegex = /<a\s+([^>]*href=["']?)([^"'\s>]+)(["']?[^>]*)>/gi;
    
    return html.replace(linkRegex, (match, before, url, after) => {
      // Skip if already a tracking link or if it's an unsubscribe link
      if (url.includes('/api/email/track/') || url.includes('unsubscribe')) {
        return match;
      }
      
      // Determine link type
      let linkType = 'general';
      if (url.includes('login')) linkType = 'login';
      else if (url.includes('report')) linkType = 'report';
      else if (url.includes('scenario')) linkType = 'scenario';
      else if (url.includes('support')) linkType = 'support';
      
      // Wrap the link
      const wrappedUrl = emailTrackingService.wrapLinkWithTracking(url, emailId, linkType);
      
      return `<a ${before}${wrappedUrl}${after}>`;
    });
  }
  
  /**
   * Determine email type from template
   */
  private getEmailType(template?: string): 'marketing' | 'transactional' | 'reports' | 'updates' | 'newsletter' {
    if (!template) return 'transactional';
    
    const templateMap: Record<string, 'marketing' | 'transactional' | 'reports' | 'updates' | 'newsletter'> = {
      'welcome': 'transactional',
      'password-reset': 'transactional',
      'report-delivery': 'reports',
      'scenario-update': 'updates',
      'newsletter': 'newsletter',
      'promotion': 'marketing',
      'campaign': 'marketing'
    };
    
    return templateMap[template] || 'transactional';
  }

  /**
   * Common email methods
   */
  async sendWelcomeEmail(user: { email: string; firstName: string; lastName: string }): Promise<boolean> {
    return this.sendEmail({
      to: user.email,
      subject: 'Welcome to Mortgage Broker Pro',
      template: 'welcome',
      templateData: {
        firstName: user.firstName,
        lastName: user.lastName,
        loginUrl: `${process.env.APP_URL}/login`
      }
    });
  }

  async sendPasswordResetEmail(user: { email: string; firstName: string }, resetToken: string): Promise<boolean> {
    const resetUrl = `${process.env.APP_URL}/reset-password?token=${resetToken}`;
    
    return this.sendEmail({
      to: user.email,
      subject: 'Reset Your Password',
      template: 'password-reset',
      templateData: {
        firstName: user.firstName,
        resetUrl,
        expiresIn: '1 hour'
      }
    });
  }

  async sendReportEmail(
    user: { email: string; firstName: string },
    report: { title: string; description: string },
    pdfBuffer: Buffer
  ): Promise<boolean> {
    return this.sendEmail({
      to: user.email,
      subject: `Your Report: ${report.title}`,
      template: 'report-delivery',
      templateData: {
        firstName: user.firstName,
        reportTitle: report.title,
        reportDescription: report.description
      },
      attachments: [{
        filename: `${report.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }]
    });
  }

  async sendScenarioUpdateEmail(
    user: { email: string; firstName: string },
    scenario: { title: string; status: string }
  ): Promise<boolean> {
    return this.sendEmail({
      to: user.email,
      subject: `Scenario Update: ${scenario.title}`,
      template: 'scenario-update',
      templateData: {
        firstName: user.firstName,
        scenarioTitle: scenario.title,
        status: scenario.status,
        viewUrl: `${process.env.APP_URL}/scenarios`
      }
    });
  }
}

// Export singleton instance
export const emailService = new EmailService();
