/**
 * Email Tracking Service
 * 
 * Tracks email opens, clicks, and engagement metrics
 */

import crypto from 'crypto';
import { emailMonitoringService } from './emailMonitoringService';
import { logger } from '../utils/logger';
import NodeCache from 'node-cache';

export interface TrackingData {
  emailId: string;
  recipient: string;
  template: string;
  sentAt: Date;
  subject?: string;
  campaign?: string;
  metadata?: Record<string, any>;
}

export interface EngagementMetrics {
  opens: number;
  firstOpenedAt?: Date;
  lastOpenedAt?: Date;
  clicks: number;
  clickedLinks: Array<{
    url: string;
    clicks: number;
    firstClickedAt: Date;
    lastClickedAt: Date;
  }>;
  unsubscribed: boolean;
  bounced: boolean;
  complained: boolean;
}

export class EmailTrackingService {
  private trackingCache: NodeCache;
  private trackingData: Map<string, TrackingData> = new Map();
  private engagementData: Map<string, EngagementMetrics> = new Map();

  constructor() {
    // Cache tracking data for 30 days
    this.trackingCache = new NodeCache({ 
      stdTTL: 2592000, // 30 days
      checkperiod: 3600 // Check every hour
    });
    
    this.loadTrackingData();
  }

  /**
   * Generate tracking pixel
   */
  generateTrackingPixel(emailId: string): string {
    const trackingId = this.generateTrackingId(emailId);
    const pixelUrl = `${process.env.APP_URL}/api/email/track/open/${trackingId}`;
    
    return `<img src="${pixelUrl}" width="1" height="1" style="display:block;border:0;" alt="" />`;
  }

  /**
   * Wrap link with tracking
   */
  wrapLinkWithTracking(url: string, emailId: string, linkType: string = 'general'): string {
    const trackingId = this.generateTrackingId(emailId);
    const encodedUrl = encodeURIComponent(url);
    const trackUrl = `${process.env.APP_URL}/api/email/track/click/${trackingId}?url=${encodedUrl}&type=${linkType}`;
    
    return trackUrl;
  }

  /**
   * Generate unique tracking ID
   */
  private generateTrackingId(emailId: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(emailId + process.env.JWT_SECRET);
    return hash.digest('hex').substring(0, 32);
  }

  /**
   * Track email sent
   */
  trackEmailSent(
    emailId: string,
    recipient: string,
    template: string,
    subject?: string,
    campaign?: string,
    metadata?: Record<string, any>
  ): void {
    const trackingData: TrackingData = {
      emailId,
      recipient,
      template,
      sentAt: new Date(),
      subject,
      campaign,
      metadata
    };
    
    const trackingId = this.generateTrackingId(emailId);
    this.trackingData.set(trackingId, trackingData);
    this.trackingCache.set(trackingId, trackingData);
    
    // Initialize engagement metrics
    this.engagementData.set(trackingId, {
      opens: 0,
      clicks: 0,
      clickedLinks: [],
      unsubscribed: false,
      bounced: false,
      complained: false
    });
  }

  /**
   * Track email open
   */
  trackOpen(trackingId: string): boolean {
    const tracking = this.getTrackingData(trackingId);
    if (!tracking) {
      logger.warn(`Invalid tracking ID for open: ${trackingId}`);
      return false;
    }
    
    const engagement = this.engagementData.get(trackingId) || {
      opens: 0,
      clicks: 0,
      clickedLinks: [],
      unsubscribed: false,
      bounced: false,
      complained: false
    };
    
    engagement.opens++;
    if (!engagement.firstOpenedAt) {
      engagement.firstOpenedAt = new Date();
    }
    engagement.lastOpenedAt = new Date();
    
    this.engagementData.set(trackingId, engagement);
    
    // Record in monitoring service
    emailMonitoringService.recordEmailOpened(tracking.template);
    
    logger.info(`Email opened: ${tracking.recipient} - ${tracking.template}`);
    return true;
  }

  /**
   * Track link click
   */
  trackClick(trackingId: string, url: string, linkType: string = 'general'): boolean {
    const tracking = this.getTrackingData(trackingId);
    if (!tracking) {
      logger.warn(`Invalid tracking ID for click: ${trackingId}`);
      return false;
    }
    
    const engagement = this.engagementData.get(trackingId) || {
      opens: 0,
      clicks: 0,
      clickedLinks: [],
      unsubscribed: false,
      bounced: false,
      complained: false
    };
    
    engagement.clicks++;
    
    // Track specific link
    let linkData = engagement.clickedLinks.find(l => l.url === url);
    if (!linkData) {
      linkData = {
        url,
        clicks: 0,
        firstClickedAt: new Date(),
        lastClickedAt: new Date()
      };
      engagement.clickedLinks.push(linkData);
    }
    
    linkData.clicks++;
    linkData.lastClickedAt = new Date();
    
    this.engagementData.set(trackingId, engagement);
    
    // Record in monitoring service
    emailMonitoringService.recordEmailClicked(tracking.template, linkType);
    
    logger.info(`Link clicked: ${tracking.recipient} - ${url}`);
    return true;
  }

  /**
   * Track unsubscribe
   */
  trackUnsubscribe(email: string): void {
    // Find all emails for this recipient
    for (const [trackingId, tracking] of this.trackingData) {
      if (tracking.recipient === email) {
        const engagement = this.engagementData.get(trackingId);
        if (engagement) {
          engagement.unsubscribed = true;
          this.engagementData.set(trackingId, engagement);
        }
      }
    }
    
    logger.info(`User unsubscribed: ${email}`);
  }

  /**
   * Track bounce
   */
  trackBounce(emailId: string, bounceType: 'hard' | 'soft'): void {
    const trackingId = this.generateTrackingId(emailId);
    const engagement = this.engagementData.get(trackingId);
    
    if (engagement) {
      engagement.bounced = true;
      this.engagementData.set(trackingId, engagement);
    }
    
    emailMonitoringService.recordEmailBounced(bounceType);
    logger.info(`Email bounced (${bounceType}): ${emailId}`);
  }

  /**
   * Track complaint
   */
  trackComplaint(emailId: string): void {
    const trackingId = this.generateTrackingId(emailId);
    const engagement = this.engagementData.get(trackingId);
    
    if (engagement) {
      engagement.complained = true;
      this.engagementData.set(trackingId, engagement);
    }
    
    logger.warn(`Spam complaint received: ${emailId}`);
  }

  /**
   * Get tracking data
   */
  private getTrackingData(trackingId: string): TrackingData | null {
    // Try memory first
    let data = this.trackingData.get(trackingId);
    
    // Try cache if not in memory
    if (!data) {
      data = this.trackingCache.get<TrackingData>(trackingId);
      if (data) {
        this.trackingData.set(trackingId, data);
      }
    }
    
    return data || null;
  }

  /**
   * Get engagement metrics for an email
   */
  getEngagementMetrics(emailId: string): EngagementMetrics | null {
    const trackingId = this.generateTrackingId(emailId);
    return this.engagementData.get(trackingId) || null;
  }

  /**
   * Get campaign metrics
   */
  getCampaignMetrics(campaignId: string): {
    sent: number;
    opened: number;
    clicked: number;
    unsubscribed: number;
    bounced: number;
    complained: number;
    openRate: number;
    clickRate: number;
    engagementRate: number;
  } {
    let sent = 0;
    let opened = 0;
    let clicked = 0;
    let unsubscribed = 0;
    let bounced = 0;
    let complained = 0;
    
    for (const [trackingId, tracking] of this.trackingData) {
      if (tracking.campaign === campaignId) {
        sent++;
        
        const engagement = this.engagementData.get(trackingId);
        if (engagement) {
          if (engagement.opens > 0) opened++;
          if (engagement.clicks > 0) clicked++;
          if (engagement.unsubscribed) unsubscribed++;
          if (engagement.bounced) bounced++;
          if (engagement.complained) complained++;
        }
      }
    }
    
    return {
      sent,
      opened,
      clicked,
      unsubscribed,
      bounced,
      complained,
      openRate: sent > 0 ? (opened / sent) * 100 : 0,
      clickRate: sent > 0 ? (clicked / sent) * 100 : 0,
      engagementRate: sent > 0 ? ((opened + clicked) / sent) * 100 : 0
    };
  }

  /**
   * Get recipient engagement history
   */
  getRecipientHistory(email: string): Array<{
    emailId: string;
    template: string;
    sentAt: Date;
    opened: boolean;
    clicked: boolean;
    engagement: EngagementMetrics;
  }> {
    const history = [];
    
    for (const [trackingId, tracking] of this.trackingData) {
      if (tracking.recipient === email) {
        const engagement = this.engagementData.get(trackingId) || {
          opens: 0,
          clicks: 0,
          clickedLinks: [],
          unsubscribed: false,
          bounced: false,
          complained: false
        };
        
        history.push({
          emailId: tracking.emailId,
          template: tracking.template,
          sentAt: tracking.sentAt,
          opened: engagement.opens > 0,
          clicked: engagement.clicks > 0,
          engagement
        });
      }
    }
    
    return history.sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());
  }

  /**
   * Clean old tracking data
   */
  cleanOldData(daysToKeep: number = 90): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    let cleaned = 0;
    
    for (const [trackingId, tracking] of this.trackingData) {
      if (tracking.sentAt < cutoffDate) {
        this.trackingData.delete(trackingId);
        this.engagementData.delete(trackingId);
        this.trackingCache.del(trackingId);
        cleaned++;
      }
    }
    
    logger.info(`Cleaned ${cleaned} old tracking records`);
  }

  /**
   * Load tracking data from cache
   */
  private loadTrackingData(): void {
    const keys = this.trackingCache.keys();
    let loaded = 0;
    
    for (const key of keys) {
      const data = this.trackingCache.get<TrackingData>(key);
      if (data) {
        this.trackingData.set(key, data);
        loaded++;
      }
    }
    
    logger.info(`Loaded ${loaded} tracking records from cache`);
  }

  /**
   * Export tracking data for analytics
   */
  exportTrackingData(startDate?: Date, endDate?: Date): any[] {
    const data = [];
    
    for (const [trackingId, tracking] of this.trackingData) {
      if (startDate && tracking.sentAt < startDate) continue;
      if (endDate && tracking.sentAt > endDate) continue;
      
      const engagement = this.engagementData.get(trackingId);
      
      data.push({
        ...tracking,
        trackingId,
        engagement
      });
    }
    
    return data;
  }
}

// Export singleton instance
export const emailTrackingService = new EmailTrackingService();
