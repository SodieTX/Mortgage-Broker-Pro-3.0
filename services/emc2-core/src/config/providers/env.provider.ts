/**
 * Environment variable configuration provider
 * Provides backward compatibility with existing .env files
 */

import { IConfigProvider } from '../../types/config.types';

export class EnvConfigProvider implements IConfigProvider {
  private prefix: string;

  constructor(prefix: string = '') {
    this.prefix = prefix;
  }

  async get<T = string>(key: string): Promise<T | undefined> {
    const envKey = this.toEnvKey(key);
    const value = process.env[envKey];
    
    if (value === undefined) {
      return undefined;
    }
    
    return this.parseValue(value) as T;
  }

  async getRequired<T = string>(key: string): Promise<T> {
    const value = await this.get<T>(key);
    if (value === undefined) {
      throw new Error(`Required environment variable "${this.toEnvKey(key)}" not found`);
    }
    return value;
  }

  async set(key: string, value: any): Promise<void> {
    const envKey = this.toEnvKey(key);
    process.env[envKey] = typeof value === 'string' ? value : JSON.stringify(value);
  }

  async delete(key: string): Promise<void> {
    const envKey = this.toEnvKey(key);
    delete process.env[envKey];
  }

  async list(): Promise<string[]> {
    const keys: string[] = [];
    const envPrefix = this.prefix ? `${this.prefix}_` : '';
    
    for (const key of Object.keys(process.env)) {
      if (key.startsWith(envPrefix)) {
        keys.push(this.fromEnvKey(key));
      }
    }
    
    return keys;
  }

  async refresh(): Promise<void> {
    // No-op for environment variables
  }

  /**
   * Convert dot notation to environment variable format
   * e.g., "database.host" -> "DATABASE_HOST"
   */
  private toEnvKey(key: string): string {
    const envKey = key.toUpperCase().replace(/\./g, '_');
    return this.prefix ? `${this.prefix}_${envKey}` : envKey;
  }

  /**
   * Convert environment variable format to dot notation
   * e.g., "DATABASE_HOST" -> "database.host"
   */
  private fromEnvKey(envKey: string): string {
    let key = envKey;
    
    if (this.prefix) {
      key = key.replace(new RegExp(`^${this.prefix}_`), '');
    }
    
    return key.toLowerCase().replace(/_/g, '.');
  }

  /**
   * Parse environment variable value
   */
  private parseValue(value: string): any {
    // Handle boolean values
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
    
    // Handle numeric values
    if (/^\d+$/.test(value)) return parseInt(value, 10);
    if (/^\d+\.\d+$/.test(value)) return parseFloat(value);
    
    // Handle JSON
    if (value.startsWith('{') || value.startsWith('[')) {
      try {
        return JSON.parse(value);
      } catch {
        // Return as string if not valid JSON
      }
    }
    
    return value;
  }
}
