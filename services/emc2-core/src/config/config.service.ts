/**
 * Configuration Service
 * Manages application configuration from multiple sources with validation
 */

import { IConfigProvider, AppConfig, AppConfigSchema } from '../types/config.types';
import { FileConfigProvider } from './providers/file.provider';
import { EnvConfigProvider } from './providers/env.provider';
import { KeyVaultConfigProvider } from './providers/keyvault.provider';
import { logger } from '../utils/logger';
import * as path from 'path';

export interface ConfigServiceOptions {
  environment?: 'development' | 'staging' | 'production';
  configPath?: string;
  encryptionKey?: string;
  useKeyVault?: boolean;
  keyVaultUrl?: string;
  providers?: IConfigProvider[];
}

export class ConfigService {
  private providers: IConfigProvider[] = [];
  private cache: Map<string, any> = new Map();
  private config?: AppConfig;
  private environment: string;

  constructor(options: ConfigServiceOptions = {}) {
    this.environment = options.environment || process.env.NODE_ENV || 'development';
    this.initializeProviders(options);
  }

  private initializeProviders(options: ConfigServiceOptions): void {
    if (options.providers) {
      // Use custom providers if provided
      this.providers = options.providers;
      return;
    }

    // Default provider setup based on environment
    if (this.environment === 'production' && options.useKeyVault && options.keyVaultUrl) {
      // Production: Key Vault first, then env vars as fallback
      this.providers.push(
        new KeyVaultConfigProvider({
          vaultUrl: options.keyVaultUrl,
          useManagedIdentity: true,
        })
      );
      this.providers.push(new EnvConfigProvider());
    } else {
      // Development/Staging: File first, then env vars
      const configPath = options.configPath || 
        path.join(process.cwd(), 'config', `config.${this.environment}.json`);
      
      this.providers.push(
        new FileConfigProvider({
          configPath,
          encryptionKey: options.encryptionKey,
          encrypted: this.environment !== 'development',
        })
      );
      this.providers.push(new EnvConfigProvider());
    }

    logger.info(`Initialized config service for ${this.environment} environment with ${this.providers.length} providers`);
  }

  /**
   * Get a configuration value
   */
  async get<T = any>(key: string): Promise<T | undefined> {
    // Check cache first
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    // Try each provider in order
    for (const provider of this.providers) {
      try {
        const value = await provider.get<T>(key);
        if (value !== undefined) {
          this.cache.set(key, value);
          return value;
        }
      } catch (error) {
        logger.warn(`Provider failed to get ${key}:`, error);
      }
    }

    return undefined;
  }

  /**
   * Get a required configuration value
   */
  async getRequired<T = any>(key: string): Promise<T> {
    const value = await this.get<T>(key);
    if (value === undefined) {
      throw new Error(`Required configuration "${key}" not found`);
    }
    return value;
  }

  /**
   * Set a configuration value
   */
  async set(key: string, value: any): Promise<void> {
    // Set in the first writable provider
    for (const provider of this.providers) {
      try {
        await provider.set(key, value);
        this.cache.set(key, value);
        return;
      } catch (error) {
        logger.warn(`Provider failed to set ${key}:`, error);
      }
    }
    
    throw new Error(`No provider could set configuration "${key}"`);
  }

  /**
   * Delete a configuration value
   */
  async delete(key: string): Promise<void> {
    // Delete from all providers
    for (const provider of this.providers) {
      try {
        await provider.delete(key);
      } catch (error) {
        logger.warn(`Provider failed to delete ${key}:`, error);
      }
    }
    this.cache.delete(key);
  }

  /**
   * Get the complete validated configuration
   */
  async getConfig(): Promise<AppConfig> {
    if (this.config) {
      return this.config;
    }

    // Build configuration from all sources
    const rawConfig: any = {
      environment: this.environment,
      database: {
        host: await this.get('database.host') || await this.get('DB_HOST') || 'localhost',
        port: await this.get('database.port') || await this.get('DB_PORT') || 5432,
        database: await this.get('database.database') || await this.get('DB_NAME') || 'mortgage_broker_pro',
        username: await this.get('database.username') || await this.get('DB_USER') || 'postgres',
        password: await this.get('database.password') || await this.get('DB_PASSWORD') || '',
        ssl: await this.get('database.ssl') || false,
        poolSize: await this.get('database.poolSize') || 10,
      },
      redis: {
        host: await this.get('redis.host') || await this.get('REDIS_HOST') || 'localhost',
        port: await this.get('redis.port') || await this.get('REDIS_PORT') || 6379,
        password: await this.get('redis.password') || await this.get('REDIS_PASSWORD'),
        db: await this.get('redis.db') || 0,
        keyPrefix: await this.get('redis.keyPrefix') || 'mbp:',
      },
      jwt: {
        secret: await this.get('jwt.secret') || await this.get('JWT_SECRET') || 'change-this-in-production',
        accessTokenExpiry: await this.get('jwt.accessTokenExpiry') || '15m',
        refreshTokenExpiry: await this.get('jwt.refreshTokenExpiry') || '7d',
        issuer: await this.get('jwt.issuer') || 'mortgage-broker-pro',
      },
      api: {
        port: await this.get('api.port') || await this.get('PORT') || 3001,
        host: await this.get('api.host') || await this.get('HOST') || '0.0.0.0',
        corsOrigin: await this.get('api.corsOrigin') || await this.get('CORS_ORIGIN'),
        rateLimit: {
          windowMs: await this.get('api.rateLimit.windowMs') || 15 * 60 * 1000,
          max: await this.get('api.rateLimit.max') || 100,
        },
        apiKeys: await this.get('api.apiKeys') || [],
      },
      features: {
        enableEmailTracking: await this.get('features.enableEmailTracking') ?? true,
        enableDocumentUpload: await this.get('features.enableDocumentUpload') ?? true,
        enableReporting: await this.get('features.enableReporting') ?? true,
      },
    };

    // Add Azure configuration if available
    const azureStorageConnection = await this.get('azure.storage.connectionString') || 
                                  await this.get('AZURE_STORAGE_CONNECTION_STRING');
    
    if (azureStorageConnection) {
      rawConfig.azure = {
        storage: {
          connectionString: azureStorageConnection,
          accountName: await this.get('azure.storage.accountName'),
          accountKey: await this.get('azure.storage.accountKey'),
          sasToken: await this.get('azure.storage.sasToken'),
        },
      };
    }

    // Add Key Vault config if available
    const keyVaultUrl = await this.get('azure.keyVault.vaultUrl') || await this.get('AZURE_KEY_VAULT_URL');
    if (keyVaultUrl) {
      rawConfig.azure = rawConfig.azure || {};
      rawConfig.azure.keyVault = {
        vaultUrl: keyVaultUrl,
        clientId: await this.get('azure.keyVault.clientId'),
        clientSecret: await this.get('azure.keyVault.clientSecret'),
        tenantId: await this.get('azure.keyVault.tenantId'),
        useManagedIdentity: await this.get('azure.keyVault.useManagedIdentity') ?? false,
      };
    }

    // Add email configuration if available
    const emailProvider = await this.get('email.provider') || await this.get('EMAIL_PROVIDER');
    if (emailProvider) {
      rawConfig.email = {
        provider: emailProvider,
        apiKey: await this.get('email.apiKey') || await this.get('EMAIL_API_KEY'),
        domain: await this.get('email.domain') || await this.get('EMAIL_DOMAIN'),
        from: {
          name: await this.get('email.from.name') || await this.get('EMAIL_FROM_NAME') || 'Mortgage Broker Pro',
          email: await this.get('email.from.email') || await this.get('EMAIL_FROM_EMAIL') || 'noreply@example.com',
        },
      };

      // Add SMTP config if using SMTP
      if (emailProvider === 'smtp') {
        rawConfig.email.smtp = {
          host: await this.get('email.smtp.host') || await this.get('SMTP_HOST'),
          port: await this.get('email.smtp.port') || await this.get('SMTP_PORT') || 587,
          secure: await this.get('email.smtp.secure') || await this.get('SMTP_SECURE') || false,
          username: await this.get('email.smtp.username') || await this.get('SMTP_USERNAME'),
          password: await this.get('email.smtp.password') || await this.get('SMTP_PASSWORD'),
        };
      }
    }

    // Validate configuration
    const result = AppConfigSchema.safeParse(rawConfig);
    if (!result.success) {
      logger.error('Configuration validation failed:', result.error);
      throw new Error(`Invalid configuration: ${result.error.message}`);
    }

    this.config = result.data;
    return this.config;
  }

  /**
   * Refresh configuration from all providers
   */
  async refresh(): Promise<void> {
    this.cache.clear();
    this.config = undefined;
    
    for (const provider of this.providers) {
      try {
        await provider.refresh();
      } catch (error) {
        logger.warn('Provider refresh failed:', error);
      }
    }
    
    logger.info('Configuration refreshed');
  }

  /**
   * Get the current environment
   */
  getEnvironment(): string {
    return this.environment;
  }

  /**
   * Check if running in production
   */
  isProduction(): boolean {
    return this.environment === 'production';
  }

  /**
   * Check if running in development
   */
  isDevelopment(): boolean {
    return this.environment === 'development';
  }
}

// Export singleton instance
let configService: ConfigService;

export function initializeConfig(options?: ConfigServiceOptions): ConfigService {
  configService = new ConfigService(options);
  return configService;
}

export function getConfigService(): ConfigService {
  if (!configService) {
    throw new Error('Configuration service not initialized. Call initializeConfig() first.');
  }
  return configService;
}
