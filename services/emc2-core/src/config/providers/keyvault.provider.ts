/**
 * Azure Key Vault configuration provider
 * Uses Azure Key Vault for production secret management
 */

import { SecretClient } from '@azure/keyvault-secrets';
import { DefaultAzureCredential, ClientSecretCredential } from '@azure/identity';
import { IConfigProvider, AzureKeyVaultConfig } from '../../types/config.types';
import { logger } from '../../utils/logger';

export class KeyVaultConfigProvider implements IConfigProvider {
  private client: SecretClient;
  private cache: Map<string, { value: any; expiresAt: Date }> = new Map();
  private cacheTimeout: number = 5 * 60 * 1000; // 5 minutes

  constructor(config: AzureKeyVaultConfig) {
    const credential = this.createCredential(config);
    this.client = new SecretClient(config.vaultUrl, credential);
  }

  private createCredential(config: AzureKeyVaultConfig) {
    if (config.useManagedIdentity) {
      // Use managed identity in production
      return new DefaultAzureCredential();
    } else if (config.clientId && config.clientSecret && config.tenantId) {
      // Use service principal
      return new ClientSecretCredential(
        config.tenantId,
        config.clientId,
        config.clientSecret
      );
    } else {
      // Fall back to default credential (works with Azure CLI, VS Code, etc.)
      return new DefaultAzureCredential();
    }
  }

  async get<T = string>(key: string): Promise<T | undefined> {
    try {
      // Check cache first
      const cached = this.getCached(key);
      if (cached !== undefined) {
        return cached as T;
      }

      // Convert dot notation to Key Vault format (replace . with -)
      const secretName = this.toSecretName(key);
      
      const secret = await this.client.getSecret(secretName);
      const value = this.parseValue(secret.value);
      
      // Cache the value
      this.setCached(key, value);
      
      return value as T;
    } catch (error: any) {
      if (error.code === 'SecretNotFound') {
        return undefined;
      }
      logger.error(`Failed to get secret ${key} from Key Vault`, error);
      throw error;
    }
  }

  async getRequired<T = string>(key: string): Promise<T> {
    const value = await this.get<T>(key);
    if (value === undefined) {
      throw new Error(`Required secret "${key}" not found in Key Vault`);
    }
    return value;
  }

  async set(key: string, value: any): Promise<void> {
    try {
      const secretName = this.toSecretName(key);
      const secretValue = typeof value === 'string' ? value : JSON.stringify(value);
      
      await this.client.setSecret(secretName, secretValue);
      
      // Invalidate cache
      this.cache.delete(key);
      
      logger.info(`Set secret ${key} in Key Vault`);
    } catch (error) {
      logger.error(`Failed to set secret ${key} in Key Vault`, error);
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const secretName = this.toSecretName(key);
      
      // Start deletion (soft delete)
      const deletePoller = await this.client.beginDeleteSecret(secretName);
      await deletePoller.pollUntilDone();
      
      // Purge if needed (permanent deletion)
      // await this.client.purgeDeletedSecret(secretName);
      
      // Invalidate cache
      this.cache.delete(key);
      
      logger.info(`Deleted secret ${key} from Key Vault`);
    } catch (error) {
      logger.error(`Failed to delete secret ${key} from Key Vault`, error);
      throw error;
    }
  }

  async list(): Promise<string[]> {
    try {
      const secrets: string[] = [];
      
      for await (const secretProperties of this.client.listPropertiesOfSecrets()) {
        secrets.push(this.fromSecretName(secretProperties.name));
      }
      
      return secrets;
    } catch (error) {
      logger.error('Failed to list secrets from Key Vault', error);
      throw error;
    }
  }

  async refresh(): Promise<void> {
    this.cache.clear();
    logger.info('Cleared Key Vault cache');
  }

  /**
   * Convert dot notation to Key Vault secret name
   * Key Vault only allows alphanumeric and hyphens
   */
  private toSecretName(key: string): string {
    return key
      .replace(/\./g, '-')
      .replace(/[^a-zA-Z0-9-]/g, '')
      .toLowerCase();
  }

  /**
   * Convert Key Vault secret name back to dot notation
   */
  private fromSecretName(secretName: string): string {
    return secretName.replace(/-/g, '.');
  }

  /**
   * Parse secret value (handle JSON strings)
   */
  private parseValue(value: string | undefined): any {
    if (!value) return undefined;
    
    try {
      // Try to parse as JSON
      return JSON.parse(value);
    } catch {
      // Return as string if not valid JSON
      return value;
    }
  }

  /**
   * Get value from cache if not expired
   */
  private getCached(key: string): any | undefined {
    const cached = this.cache.get(key);
    if (!cached) return undefined;
    
    if (new Date() > cached.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    
    return cached.value;
  }

  /**
   * Set value in cache with expiration
   */
  private setCached(key: string, value: any): void {
    const expiresAt = new Date(Date.now() + this.cacheTimeout);
    this.cache.set(key, { value, expiresAt });
  }
}
