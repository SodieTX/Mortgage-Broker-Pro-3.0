/**
 * Services Index
 * 
 * Exports all services with proper initialization handling
 */

// Export the safe email wrapper
export { email, EmailOptions, BulkEmailOptions } from './email';

// Export service initializer for manual initialization if needed
export { ServiceInitializer } from './serviceInitializer';

// Export other services that might be needed directly
// Note: These should be accessed through dynamic imports to avoid circular dependencies
export type { EmailPreferences } from './emailPreferencesService';
export type { EmailMetrics, ProviderMetrics } from './emailMonitoringService';
export type { TrackingData, EngagementMetrics } from './emailTrackingService';
export type { EmailJob, EmailCampaign, CampaignStep } from './emailQueueService';
