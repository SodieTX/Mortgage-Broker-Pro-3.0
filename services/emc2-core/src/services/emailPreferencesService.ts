/**
 * Email Preferences Service
 * 
 * Manages user email preferences and suppression lists
 */

import { logger } from '../utils/logger';
import NodeCache from 'node-cache';

export interface EmailPreferences {
  userId: string;
  email: string;
  preferences: {
    marketing: boolean;
    transactional: boolean;
    reports: boolean;
    updates: boolean;
    newsletter: boolean;
  };
  frequency: 'immediate' | 'daily' | 'weekly' | 'monthly';
  timezone: string;
  unsubscribedAt?: Date;
  suppressedAt?: Date;
  suppressionReason?: 'bounce' | 'complaint' | 'manual' | 'unsubscribe';
  updatedAt: Date;
}

export interface SuppressionEntry {
  email: string;
  reason: 'bounce' | 'complaint' | 'manual' | 'unsubscribe';
  date: Date;
  permanent: boolean;
}

export class EmailPreferencesService {
  private preferencesCache: NodeCache;
  private suppressionList: Map<string, SuppressionEntry> = new Map();
  private preferences: Map<string, EmailPreferences> = new Map();

  constructor() {
    // Cache preferences for 1 hour
    this.preferencesCache = new NodeCache({
      stdTTL: 3600,
      checkperiod: 600
    });
    
    this.loadSuppressionList();
  }

  /**
   * Get user email preferences
   */
  async getUserPreferences(userId: string, email: string): Promise<EmailPreferences> {
    // Check cache first
    const cached = this.preferencesCache.get<EmailPreferences>(`pref:${email}`);
    if (cached) {
      return cached;
    }
    
    // Check memory
    let prefs = this.preferences.get(email);
    
    // If not found, create default preferences
    if (!prefs) {
      prefs = {
        userId,
        email,
        preferences: {
          marketing: true,
          transactional: true,
          reports: true,
          updates: true,
          newsletter: true
        },
        frequency: 'immediate',
        timezone: 'America/New_York',
        updatedAt: new Date()
      };
      
      this.preferences.set(email, prefs);
    }
    
    // Cache it
    this.preferencesCache.set(`pref:${email}`, prefs);
    
    return prefs;
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(
    email: string,
    updates: Partial<EmailPreferences>
  ): Promise<EmailPreferences> {
    const current = await this.getUserPreferences('', email);
    
    const updated = {
      ...current,
      ...updates,
      email, // Ensure email doesn't change
      updatedAt: new Date()
    };
    
    this.preferences.set(email, updated);
    this.preferencesCache.set(`pref:${email}`, updated);
    
    logger.info(`Updated email preferences for ${email}`);
    
    return updated;
  }

  /**
   * Check if email can be sent to user
   */
  async canSendEmail(
    email: string,
    emailType: 'marketing' | 'transactional' | 'reports' | 'updates' | 'newsletter'
  ): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    // Check suppression list first
    if (this.isEmailSuppressed(email)) {
      const suppression = this.suppressionList.get(email.toLowerCase());
      return {
        allowed: false,
        reason: `Email suppressed due to ${suppression?.reason}`
      };
    }
    
    // Get user preferences
    const prefs = await this.getUserPreferences('', email);
    
    // Check if user has unsubscribed
    if (prefs.unsubscribedAt) {
      return {
        allowed: false,
        reason: 'User unsubscribed'
      };
    }
    
    // Check specific preference
    if (!prefs.preferences[emailType]) {
      return {
        allowed: false,
        reason: `User opted out of ${emailType} emails`
      };
    }
    
    return { allowed: true };
  }

  /**
   * Add email to suppression list
   */
  suppressEmail(
    email: string,
    reason: 'bounce' | 'complaint' | 'manual' | 'unsubscribe',
    permanent: boolean = false
  ): void {
    const entry: SuppressionEntry = {
      email: email.toLowerCase(),
      reason,
      date: new Date(),
      permanent
    };
    
    this.suppressionList.set(email.toLowerCase(), entry);
    
    // Update user preferences
    const prefs = this.preferences.get(email);
    if (prefs) {
      prefs.suppressedAt = new Date();
      prefs.suppressionReason = reason;
      this.preferences.set(email, prefs);
      this.preferencesCache.del(`pref:${email}`);
    }
    
    logger.info(`Email suppressed: ${email} (${reason})`);
  }

  /**
   * Remove email from suppression list
   */
  unsuppressEmail(email: string): boolean {
    const removed = this.suppressionList.delete(email.toLowerCase());
    
    if (removed) {
      // Update user preferences
      const prefs = this.preferences.get(email);
      if (prefs) {
        delete prefs.suppressedAt;
        delete prefs.suppressionReason;
        this.preferences.set(email, prefs);
        this.preferencesCache.del(`pref:${email}`);
      }
      
      logger.info(`Email unsuppressed: ${email}`);
    }
    
    return removed;
  }

  /**
   * Check if email is suppressed
   */
  isEmailSuppressed(email: string): boolean {
    return this.suppressionList.has(email.toLowerCase());
  }

  /**
   * Handle unsubscribe request
   */
  async handleUnsubscribe(
    email: string,
    options?: {
      categories?: Array<'marketing' | 'transactional' | 'reports' | 'updates' | 'newsletter'>;
      all?: boolean;
    }
  ): Promise<void> {
    const prefs = await this.getUserPreferences('', email);
    
    if (options?.all) {
      // Unsubscribe from all
      prefs.unsubscribedAt = new Date();
      prefs.preferences = {
        marketing: false,
        transactional: true, // Keep transactional emails
        reports: false,
        updates: false,
        newsletter: false
      };
    } else if (options?.categories) {
      // Unsubscribe from specific categories
      for (const category of options.categories) {
        prefs.preferences[category] = false;
      }
    } else {
      // Default: unsubscribe from marketing only
      prefs.preferences.marketing = false;
      prefs.preferences.newsletter = false;
    }
    
    prefs.updatedAt = new Date();
    this.preferences.set(email, prefs);
    this.preferencesCache.set(`pref:${email}`, prefs);
    
    logger.info(`User unsubscribed: ${email}`);
  }

  /**
   * Handle resubscribe request
   */
  async handleResubscribe(email: string): Promise<void> {
    // Remove from suppression list if present
    this.unsuppressEmail(email);
    
    // Update preferences
    const prefs = await this.getUserPreferences('', email);
    delete prefs.unsubscribedAt;
    prefs.preferences = {
      marketing: true,
      transactional: true,
      reports: true,
      updates: true,
      newsletter: true
    };
    prefs.updatedAt = new Date();
    
    this.preferences.set(email, prefs);
    this.preferencesCache.set(`pref:${email}`, prefs);
    
    logger.info(`User resubscribed: ${email}`);
  }

  /**
   * Get suppression list stats
   */
  getSuppressionStats(): {
    total: number;
    byReason: Record<string, number>;
    permanent: number;
    temporary: number;
  } {
    const stats = {
      total: this.suppressionList.size,
      byReason: {} as Record<string, number>,
      permanent: 0,
      temporary: 0
    };
    
    for (const [_, entry] of this.suppressionList) {
      stats.byReason[entry.reason] = (stats.byReason[entry.reason] || 0) + 1;
      if (entry.permanent) {
        stats.permanent++;
      } else {
        stats.temporary++;
      }
    }
    
    return stats;
  }

  /**
   * Load suppression list from storage
   */
  private loadSuppressionList(): void {
    // In production, load from database
    // For now, just log
    logger.info('Loaded suppression list');
  }

  /**
   * Export suppression list
   */
  exportSuppressionList(): SuppressionEntry[] {
    return Array.from(this.suppressionList.values());
  }

  /**
   * Import suppression list
   */
  importSuppressionList(entries: SuppressionEntry[]): void {
    for (const entry of entries) {
      this.suppressionList.set(entry.email.toLowerCase(), entry);
    }
    logger.info(`Imported ${entries.length} suppression entries`);
  }

  /**
   * Clean old temporary suppressions
   */
  cleanOldSuppressions(daysToKeep: number = 30): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    let cleaned = 0;
    
    for (const [email, entry] of this.suppressionList) {
      if (!entry.permanent && entry.date < cutoffDate) {
        this.suppressionList.delete(email);
        cleaned++;
      }
    }
    
    logger.info(`Cleaned ${cleaned} old suppression entries`);
    return cleaned;
  }
}

// Export singleton instance
export const emailPreferencesService = new EmailPreferencesService();
