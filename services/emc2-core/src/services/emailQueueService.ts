/**
 * Email Queue Service
 * 
 * Handles email queuing, scheduling, and campaign management
 */

import Queue from 'bull';
import { emailConfig } from '../config/email';
import { emailService, EmailOptions } from './emailService';
import { logger } from '../utils/logger';

export interface EmailJob {
  id: string;
  type: 'single' | 'bulk' | 'campaign';
  data: EmailOptions | BulkEmailJob | CampaignJob;
  priority?: number;
  delay?: number;
  attempts?: number;
  backoff?: {
    type: 'fixed' | 'exponential';
    delay: number;
  };
}

export interface BulkEmailJob {
  recipients: Array<{
    email: string;
    data?: Record<string, any>;
  }>;
  subject: string;
  template: string;
  baseData?: Record<string, any>;
  batchSize?: number;
  delayBetweenBatches?: number;
}

export interface CampaignJob {
  campaignId: string;
  step: number;
  recipientId: string;
  email: string;
  subject: string;
  template: string;
  data: Record<string, any>;
}

export interface EmailCampaign {
  id: string;
  name: string;
  description?: string;
  steps: CampaignStep[];
  recipients: CampaignRecipient[];
  startDate: Date;
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed';
}

export interface CampaignStep {
  id: string;
  order: number;
  delayDays: number; // Days after previous step (0 for first step)
  subject: string;
  template: string;
  condition?: {
    field: string;
    operator: 'equals' | 'contains' | 'greater' | 'less';
    value: any;
  };
}

export interface CampaignRecipient {
  id: string;
  email: string;
  data: Record<string, any>;
  currentStep: number;
  status: 'pending' | 'active' | 'completed' | 'unsubscribed';
  lastSentAt?: Date;
}

export class EmailQueueService {
  private emailQueue: Queue.Queue | null = null;
  private campaignQueue: Queue.Queue | null = null;
  private isInitialized = false;

  constructor() {
    // Initialize on first use
  }

  /**
   * Initialize the queue service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Create queues
      this.emailQueue = new Queue('email-queue', {
        redis: emailConfig.queue.redis
      });

      this.campaignQueue = new Queue('campaign-queue', {
        redis: emailConfig.queue.redis
      });

      // Set up queue processors
      this.setupProcessors();

      // Set up event handlers
      this.setupEventHandlers();

      this.isInitialized = true;
      logger.info('Email queue service initialized');
    } catch (error) {
      logger.error('Failed to initialize email queue service:', error);
      // Allow service to run without queuing
    }
  }

  /**
   * Set up queue processors
   */
  private setupProcessors(): void {
    if (!this.emailQueue || !this.campaignQueue) return;

    // Process email queue
    this.emailQueue.process('single', async (job) => {
      const options = job.data as EmailOptions;
      return await emailService.sendEmail(options);
    });

    this.emailQueue.process('bulk', async (job) => {
      const bulkJob = job.data as BulkEmailJob;
      await emailService.sendBulkEmails(bulkJob);
    });

    // Process campaign queue
    this.campaignQueue.process(async (job) => {
      const campaignJob = job.data as CampaignJob;
      
      await emailService.sendEmail({
        to: campaignJob.email,
        subject: campaignJob.subject,
        template: campaignJob.template,
        templateData: campaignJob.data
      });

      // Schedule next step if applicable
      // This would check campaign status and schedule next email
    });
  }

  /**
   * Set up event handlers
   */
  private setupEventHandlers(): void {
    if (!this.emailQueue) return;

    this.emailQueue.on('completed', (job) => {
      logger.info(`Email job ${job.id} completed`);
    });

    this.emailQueue.on('failed', (job, err) => {
      logger.error(`Email job ${job.id} failed:`, err);
    });

    this.emailQueue.on('stalled', (job) => {
      logger.warn(`Email job ${job.id} stalled`);
    });
  }

  /**
   * Queue a single email
   */
  async queueEmail(
    options: EmailOptions,
    jobOptions?: {
      priority?: number;
      delay?: number;
      attempts?: number;
    }
  ): Promise<string> {
    await this.initialize();

    if (!this.emailQueue) {
      // Fallback to direct send
      await emailService.sendEmailWithRetry(options);
      return `direct-${Date.now()}`;
    }

    const job = await this.emailQueue.add('single', options, {
      priority: jobOptions?.priority || 0,
      delay: jobOptions?.delay || 0,
      attempts: jobOptions?.attempts || emailConfig.queue.retryAttempts,
      backoff: {
        type: 'exponential',
        delay: emailConfig.queue.retryDelay
      },
      removeOnComplete: true,
      removeOnFail: false
    });

    return job.id.toString();
  }

  /**
   * Queue bulk emails
   */
  async queueBulkEmails(
    bulkJob: BulkEmailJob,
    scheduleDate?: Date
  ): Promise<string> {
    await this.initialize();

    if (!this.emailQueue) {
      // Fallback to direct send
      await emailService.sendBulkEmails(bulkJob);
      return `direct-bulk-${Date.now()}`;
    }

    const delay = scheduleDate 
      ? scheduleDate.getTime() - Date.now()
      : 0;

    const job = await this.emailQueue.add('bulk', bulkJob, {
      delay: Math.max(0, delay),
      removeOnComplete: true,
      removeOnFail: false
    });

    return job.id.toString();
  }

  /**
   * Create and start an email campaign
   */
  async createCampaign(campaign: EmailCampaign): Promise<void> {
    await this.initialize();

    if (!this.campaignQueue) {
      throw new Error('Campaign queue not available');
    }

    // Schedule first step for each recipient
    for (const recipient of campaign.recipients) {
      if (recipient.status !== 'active') continue;

      const firstStep = campaign.steps[0];
      if (!firstStep) continue;

      const delay = campaign.startDate.getTime() - Date.now();

      await this.campaignQueue.add({
        campaignId: campaign.id,
        step: 0,
        recipientId: recipient.id,
        email: recipient.email,
        subject: firstStep.subject,
        template: firstStep.template,
        data: {
          ...recipient.data,
          campaignName: campaign.name
        }
      }, {
        delay: Math.max(0, delay),
        removeOnComplete: true,
        removeOnFail: false
      });
    }

    logger.info(`Campaign ${campaign.id} created with ${campaign.recipients.length} recipients`);
  }

  /**
   * Pause a campaign
   */
  async pauseCampaign(campaignId: string): Promise<void> {
    if (!this.campaignQueue) return;

    const jobs = await this.campaignQueue.getJobs(['delayed', 'waiting']);
    
    for (const job of jobs) {
      if (job.data.campaignId === campaignId) {
        await job.remove();
      }
    }

    logger.info(`Campaign ${campaignId} paused`);
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    email: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
    };
    campaign: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
    };
  }> {
    await this.initialize();

    const defaultStats = {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0
    };

    if (!this.emailQueue || !this.campaignQueue) {
      return {
        email: defaultStats,
        campaign: defaultStats
      };
    }

    const [
      emailWaiting,
      emailActive,
      emailCompleted,
      emailFailed,
      emailDelayed,
      campaignWaiting,
      campaignActive,
      campaignCompleted,
      campaignFailed,
      campaignDelayed
    ] = await Promise.all([
      this.emailQueue.getWaitingCount(),
      this.emailQueue.getActiveCount(),
      this.emailQueue.getCompletedCount(),
      this.emailQueue.getFailedCount(),
      this.emailQueue.getDelayedCount(),
      this.campaignQueue.getWaitingCount(),
      this.campaignQueue.getActiveCount(),
      this.campaignQueue.getCompletedCount(),
      this.campaignQueue.getFailedCount(),
      this.campaignQueue.getDelayedCount()
    ]);

    return {
      email: {
        waiting: emailWaiting,
        active: emailActive,
        completed: emailCompleted,
        failed: emailFailed,
        delayed: emailDelayed
      },
      campaign: {
        waiting: campaignWaiting,
        active: campaignActive,
        completed: campaignCompleted,
        failed: campaignFailed,
        delayed: campaignDelayed
      }
    };
  }

  /**
   * Clean old completed jobs
   */
  async cleanQueues(olderThan: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    if (!this.emailQueue || !this.campaignQueue) return;

    await Promise.all([
      this.emailQueue.clean(olderThan, 'completed'),
      this.emailQueue.clean(olderThan, 'failed'),
      this.campaignQueue.clean(olderThan, 'completed'),
      this.campaignQueue.clean(olderThan, 'failed')
    ]);

    logger.info('Queue cleanup completed');
  }
}

// Export singleton instance
export const emailQueueService = new EmailQueueService();
