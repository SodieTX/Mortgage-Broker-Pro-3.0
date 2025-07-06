/**
 * Application Configuration Initialization
 * Sets up the configuration service and provides config to the app
 */

import { initializeConfig, getConfigService } from './config.service';
import { AppConfig } from '../types/config.types';
import { logger } from '../utils/logger';

let appConfig: AppConfig | null = null;

/**
 * Initialize application configuration
 * This should be called at application startup
 */
export async function initializeAppConfig(): Promise<AppConfig> {
  try {
    logger.info('Initializing application configuration...');
    
    // Initialize config service with environment detection
    const configService = initializeConfig({
      environment: process.env.NODE_ENV as any,
      // Use Key Vault in production if URL is provided
      useKeyVault: !!process.env.AZURE_KEY_VAULT_URL,
      keyVaultUrl: process.env.AZURE_KEY_VAULT_URL,
    });
    
    // Load and validate configuration
    appConfig = await configService.getConfig();
    
    logger.info(`Configuration loaded for ${appConfig.environment} environment`);
    
    // Log feature flags
    logger.info('Feature flags:', appConfig.features);
    
    return appConfig;
  } catch (error) {
    logger.error('Failed to initialize configuration:', error);
    throw new Error(`Configuration initialization failed: ${error}`);
  }
}

/**
 * Get the current application configuration
 * Throws if configuration hasn't been initialized
 */
export function getAppConfig(): AppConfig {
  if (!appConfig) {
    throw new Error('Configuration not initialized. Call initializeAppConfig() first.');
  }
  return appConfig;
}

/**
 * Update configuration and reload
 * Useful for testing or runtime updates
 */
export async function reloadConfig(): Promise<AppConfig> {
  const configService = getConfigService();
  await configService.refresh();
  appConfig = await configService.getConfig();
  logger.info('Configuration reloaded');
  return appConfig;
}

/**
 * Get a specific configuration value
 * Convenience method for getting nested values
 */
export async function getConfigValue<T = any>(key: string): Promise<T | undefined> {
  const configService = getConfigService();
  return configService.get<T>(key);
}

/**
 * Get a required configuration value
 * Throws if value is not found
 */
export async function getRequiredConfigValue<T = any>(key: string): Promise<T> {
  const configService = getConfigService();
  return configService.getRequired<T>(key);
}
