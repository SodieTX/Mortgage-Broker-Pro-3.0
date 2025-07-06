/**
 * Encryption utilities for configuration management
 * Uses AES-256-GCM for encryption
 */

import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const SALT_LENGTH = 64; // 512 bits

export interface EncryptedData {
  encrypted: string;
  iv: string;
  tag: string;
  salt: string;
}

export class EncryptionUtil {
  private key: Buffer;

  constructor(masterKey?: string) {
    if (masterKey) {
      // Derive key from master key using PBKDF2
      const salt = crypto.randomBytes(SALT_LENGTH);
      this.key = crypto.pbkdf2Sync(masterKey, salt, 100000, KEY_LENGTH, 'sha256');
    } else {
      // Generate from machine ID or environment for development
      this.key = this.deriveKeyFromEnvironment();
    }
  }

  /**
   * Derives a key from environment-specific data
   * This is less secure but suitable for development
   */
  private deriveKeyFromEnvironment(): Buffer {
    const sources = [
      process.env.HOSTNAME || 'localhost',
      process.env.USER || 'default',
      process.env.NODE_ENV || 'development',
      __dirname, // Application path
    ];
    
    const combined = sources.join('|');
    return crypto.pbkdf2Sync(combined, 'mortgage-broker-pro', 10000, KEY_LENGTH, 'sha256');
  }

  /**
   * Encrypts data using AES-256-GCM
   */
  encrypt(data: string | object): EncryptedData {
    const text = typeof data === 'string' ? data : JSON.stringify(data);
    const iv = crypto.randomBytes(IV_LENGTH);
    const salt = crypto.randomBytes(SALT_LENGTH);
    
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    const tag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      salt: salt.toString('base64'),
    };
  }

  /**
   * Decrypts data encrypted with AES-256-GCM
   */
  decrypt<T = any>(encryptedData: EncryptedData): T {
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      this.key,
      Buffer.from(encryptedData.iv, 'base64')
    );
    
    decipher.setAuthTag(Buffer.from(encryptedData.tag, 'base64'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    try {
      return JSON.parse(decrypted);
    } catch {
      return decrypted as any;
    }
  }

  /**
   * Encrypts and saves data to a file
   */
  async encryptToFile(filePath: string, data: any): Promise<void> {
    const encrypted = this.encrypt(data);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(encrypted, null, 2));
  }

  /**
   * Reads and decrypts data from a file
   */
  async decryptFromFile<T = any>(filePath: string): Promise<T> {
    const content = await fs.readFile(filePath, 'utf8');
    const encryptedData: EncryptedData = JSON.parse(content);
    return this.decrypt<T>(encryptedData);
  }

  /**
   * Generates a secure random key
   */
  static generateKey(): string {
    return crypto.randomBytes(KEY_LENGTH).toString('base64');
  }

  /**
   * Hashes a value for comparison (e.g., API keys)
   */
  static hash(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  /**
   * Compares a value with a hash (timing-safe)
   */
  static compareHash(value: string, hash: string): boolean {
    const valueHash = this.hash(value);
    return crypto.timingSafeEqual(
      Buffer.from(valueHash),
      Buffer.from(hash)
    );
  }
}
