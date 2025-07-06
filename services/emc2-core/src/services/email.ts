/**
 * Email Service Wrapper
 * 
 * Provides a safe wrapper around email service that ensures initialization
 */

import { ServiceInitializer } from './serviceInitializer';
import { EmailOptions, BulkEmailOptions } from './emailService';

class EmailServiceWrapper {
  private initPromise: Promise<void> | null = null;

  /**
   * Ensure services are initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = ServiceInitializer.initialize();
    }
    await this.initPromise;
  }

  /**
   * Send a single email
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    await this.ensureInitialized();
    const { emailService } = await import('./emailService');
    return emailService.sendEmail(options);
  }

  /**
   * Send email with retry logic
   */
  async sendEmailWithRetry(options: EmailOptions, maxRetries?: number): Promise<boolean> {
    await this.ensureInitialized();
    const { emailService } = await import('./emailService');
    return emailService.sendEmailWithRetry(options, maxRetries);
  }

  /**
   * Queue email for background processing
   */
  async queueEmail(options: EmailOptions, priority?: number): Promise<string> {
    await this.ensureInitialized();
    const { emailService } = await import('./emailService');
    return emailService.queueEmail(options, priority);
  }

  /**
   * Send bulk emails with batching
   */
  async sendBulkEmails(options: BulkEmailOptions): Promise<void> {
    await this.ensureInitialized();
    const { emailService } = await import('./emailService');
    return emailService.sendBulkEmails(options);
  }

  /**
   * Common email methods
   */
  async sendWelcomeEmail(user: { email: string; firstName: string; lastName: string }): Promise<boolean> {
    await this.ensureInitialized();
    const { emailService } = await import('./emailService');
    return emailService.sendWelcomeEmail(user);
  }

  async sendPasswordResetEmail(user: { email: string; firstName: string }, resetToken: string): Promise<boolean> {
    await this.ensureInitialized();
    const { emailService } = await import('./emailService');
    return emailService.sendPasswordResetEmail(user, resetToken);
  }

  async sendReportEmail(
    user: { email: string; firstName: string },
    report: { title: string; description: string },
    pdfBuffer: Buffer
  ): Promise<boolean> {
    await this.ensureInitialized();
    const { emailService } = await import('./emailService');
    return emailService.sendReportEmail(user, report, pdfBuffer);
  }

  async sendScenarioUpdateEmail(
    user: { email: string; firstName: string },
    scenario: { title: string; status: string }
  ): Promise<boolean> {
    await this.ensureInitialized();
    const { emailService } = await import('./emailService');
    return emailService.sendScenarioUpdateEmail(user, scenario);
  }
}

// Export singleton instance
export const email = new EmailServiceWrapper();

// Re-export types
export { EmailOptions, BulkEmailOptions } from './emailService';
