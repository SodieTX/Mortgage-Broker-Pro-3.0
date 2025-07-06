/**
 * File-based configuration provider
 * Uses encrypted JSON files for local development
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { IConfigProvider } from '../../types/config.types';
import { EncryptionUtil } from '../../utils/encryption';
import { logger } from '../../utils/logger';

export interface FileProviderOptions {
  configPath?: string;
  encryptionKey?: string;
  encrypted?: boolean;
}

export class FileConfigProvider implements IConfigProvider {
  private configPath: string;
  private encryption: EncryptionUtil | null;
  private cache: Map<string, any> = new Map();
  private loaded = false;

  constructor(options: FileProviderOptions = {}) {
    this.configPath = options.configPath || path.join(process.cwd(), 'config', 'config.json');
    this.encryption = options.encrypted !== false ? new EncryptionUtil(options.encryptionKey) : null;
  }

  async get<T = string>(key: string): Promise<T | undefined> {
    await this.ensureLoaded();
    return this.getNestedValue(key) as T | undefined;
  }

  async getRequired<T = string>(key: string): Promise<T> {
    const value = await this.get<T>(key);
    if (value === undefined) {
      throw new Error(`Required configuration key "${key}" not found`);
    }
    return value;
  }

  async set(key: string, value: any): Promise<void> {
    await this.ensureLoaded();
    this.setNestedValue(key, value);
    await this.save();
  }

  async delete(key: string): Promise<void> {
    await this.ensureLoaded();
    this.deleteNestedValue(key);
    await this.save();
  }

  async list(): Promise<string[]> {
    await this.ensureLoaded();
    return Array.from(this.cache.keys());
  }

  async refresh(): Promise<void> {
    this.loaded = false;
    this.cache.clear();
    await this.load();
  }

  private async ensureLoaded(): Promise<void> {
    if (!this.loaded) {
      await this.load();
    }
  }

  private async load(): Promise<void> {
    try {
      const exists = await this.fileExists(this.configPath);
      if (!exists) {
        logger.info(`Config file not found at ${this.configPath}, starting with empty config`);
        this.loaded = true;
        return;
      }

      let data: any;
      if (this.encryption) {
        // Check if file is encrypted by trying to parse as JSON first
        const content = await fs.readFile(this.configPath, 'utf8');
        try {
          const parsed = JSON.parse(content);
          if (parsed.encrypted && parsed.iv && parsed.tag) {
            // File is encrypted
            data = await this.encryption.decryptFromFile(this.configPath);
          } else {
            // File is not encrypted, use as-is
            data = parsed;
          }
        } catch {
          // Not valid JSON, assume it's plain text config
          data = {};
        }
      } else {
        const content = await fs.readFile(this.configPath, 'utf8');
        data = JSON.parse(content);
      }

      // Flatten nested config into dot notation
      this.flattenConfig(data);
      this.loaded = true;
      logger.info(`Loaded configuration from ${this.configPath}`);
    } catch (error) {
      logger.error('Failed to load configuration file', error);
      throw new Error(`Failed to load config: ${error}`);
    }
  }

  private async save(): Promise<void> {
    try {
      // Unflatten dot notation back to nested object
      const data = this.unflattenConfig();
      
      await fs.mkdir(path.dirname(this.configPath), { recursive: true });
      
      if (this.encryption) {
        await this.encryption.encryptToFile(this.configPath, data);
      } else {
        await fs.writeFile(this.configPath, JSON.stringify(data, null, 2));
      }
      
      logger.info(`Saved configuration to ${this.configPath}`);
    } catch (error) {
      logger.error('Failed to save configuration file', error);
      throw new Error(`Failed to save config: ${error}`);
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private flattenConfig(obj: any, prefix = ''): void {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const newKey = prefix ? `${prefix}.${key}` : key;
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          this.flattenConfig(obj[key], newKey);
        } else {
          this.cache.set(newKey, obj[key]);
        }
      }
    }
  }

  private unflattenConfig(): any {
    const result: any = {};
    
    for (const [key, value] of this.cache.entries()) {
      const parts = key.split('.');
      let current = result;
      
      for (let i = 0; i < parts.length - 1; i++) {
        if (!(parts[i] in current)) {
          current[parts[i]] = {};
        }
        current = current[parts[i]];
      }
      
      current[parts[parts.length - 1]] = value;
    }
    
    return result;
  }

  private getNestedValue(key: string): any {
    // First check if we have an exact match
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    // Then check for nested object
    const result: any = {};
    let hasValues = false;
    
    for (const [k, v] of this.cache.entries()) {
      if (k.startsWith(key + '.')) {
        const subKey = k.substring(key.length + 1);
        this.setDeepValue(result, subKey, v);
        hasValues = true;
      }
    }
    
    return hasValues ? result : undefined;
  }

  private setNestedValue(key: string, value: any): void {
    // Remove any existing nested values
    const keysToDelete: string[] = [];
    for (const k of this.cache.keys()) {
      if (k.startsWith(key + '.')) {
        keysToDelete.push(k);
      }
    }
    keysToDelete.forEach(k => this.cache.delete(k));

    // Set the new value
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Flatten nested object
      this.flattenConfig(value, key);
    } else {
      this.cache.set(key, value);
    }
  }

  private deleteNestedValue(key: string): void {
    // Delete exact key
    this.cache.delete(key);
    
    // Delete any nested keys
    const keysToDelete: string[] = [];
    for (const k of this.cache.keys()) {
      if (k.startsWith(key + '.')) {
        keysToDelete.push(k);
      }
    }
    keysToDelete.forEach(k => this.cache.delete(k));
  }

  private setDeepValue(obj: any, path: string, value: any): void {
    const parts = path.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in current)) {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }
    
    current[parts[parts.length - 1]] = value;
  }
}
