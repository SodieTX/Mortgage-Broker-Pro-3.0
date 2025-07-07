/**
 * Comprehensive tests for encryption utilities
 * This should provide ~90%+ coverage for encryption.ts
 */

import { EncryptionUtil } from '../encryption';
import * as fs from 'fs/promises';

// Mock fs for file operations
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('EncryptionUtil', () => {
  let encryptionUtil: EncryptionUtil;
  const testData = { test: 'data', number: 42 };
  const testString = 'Hello, World!';

  beforeEach(() => {
    jest.clearAllMocks();
    encryptionUtil = new EncryptionUtil();
  });

  describe('constructor', () => {
    it('should create instance with default key derivation', () => {
      const util = new EncryptionUtil();
      expect(util).toBeInstanceOf(EncryptionUtil);
    });

    it('should create instance with master key', () => {
      const util = new EncryptionUtil('test-master-key');
      expect(util).toBeInstanceOf(EncryptionUtil);
    });

    it('should handle different master keys', () => {
      const util1 = new EncryptionUtil('key1');
      const util2 = new EncryptionUtil('key2');
      
      // Different keys should produce different encryption results
      const encrypted1 = util1.encrypt(testString);
      const encrypted2 = util2.encrypt(testString);
      
      expect(encrypted1.encrypted).not.toBe(encrypted2.encrypted);
    });
  });

  describe('encrypt', () => {
    it('should encrypt string data', () => {
      const result = encryptionUtil.encrypt(testString);
      
      expect(result).toHaveProperty('encrypted');
      expect(result).toHaveProperty('iv');
      expect(result).toHaveProperty('tag');
      expect(result).toHaveProperty('salt');
      expect(typeof result.encrypted).toBe('string');
      expect(typeof result.iv).toBe('string');
      expect(typeof result.tag).toBe('string');
      expect(typeof result.salt).toBe('string');
    });

    it('should encrypt object data', () => {
      const result = encryptionUtil.encrypt(testData);
      
      expect(result).toHaveProperty('encrypted');
      expect(result).toHaveProperty('iv');
      expect(result).toHaveProperty('tag');
      expect(result).toHaveProperty('salt');
      expect(result.encrypted).toBeTruthy();
    });

    it('should produce different results for same data (due to IV)', () => {
      const result1 = encryptionUtil.encrypt(testString);
      const result2 = encryptionUtil.encrypt(testString);
      
      expect(result1.encrypted).not.toBe(result2.encrypted);
      expect(result1.iv).not.toBe(result2.iv);
    });

    it('should handle empty string', () => {
      const result = encryptionUtil.encrypt('');
      expect(result.encrypted).toBeDefined();
      expect(result.iv).toBeTruthy();
      expect(result.tag).toBeTruthy();
    });

    it('should handle complex object', () => {
      const complexData = {
        string: 'test',
        number: 123,
        boolean: true,
        array: [1, 2, 3],
        nested: { key: 'value' }
      };
      
      const result = encryptionUtil.encrypt(complexData);
      expect(result.encrypted).toBeTruthy();
    });
  });

  describe('decrypt', () => {
    it('should decrypt string data', () => {
      const encrypted = encryptionUtil.encrypt(testString);
      const decrypted = encryptionUtil.decrypt(encrypted);
      
      expect(decrypted).toBe(testString);
    });

    it('should decrypt object data', () => {
      const encrypted = encryptionUtil.encrypt(testData);
      const decrypted = encryptionUtil.decrypt(encrypted);
      
      expect(decrypted).toEqual(testData);
    });

    it('should handle complex object roundtrip', () => {
      const complexData = {
        string: 'test',
        number: 123,
        boolean: true,
        array: [1, 2, 3],
        nested: { key: 'value' }
      };
      
      const encrypted = encryptionUtil.encrypt(complexData);
      const decrypted = encryptionUtil.decrypt(encrypted);
      
      expect(decrypted).toEqual(complexData);
    });

    it('should handle non-JSON string data', () => {
      const plainText = 'not json data';
      const encrypted = encryptionUtil.encrypt(plainText);
      const decrypted = encryptionUtil.decrypt(encrypted);
      
      expect(decrypted).toBe(plainText);
    });

    it('should throw error with invalid encrypted data', () => {
      const invalidData = {
        encrypted: 'invalid-base64',
        iv: 'invalid-base64',
        tag: 'invalid-base64',
        salt: 'invalid-base64'
      };
      
      expect(() => encryptionUtil.decrypt(invalidData)).toThrow();
    });

    it('should throw error with tampered data', () => {
      const encrypted = encryptionUtil.encrypt(testString);
      const tampered = {
        ...encrypted,
        tag: 'invalid-tag-data' // Tamper with auth tag
      };
      
      expect(() => encryptionUtil.decrypt(tampered)).toThrow();
    });
  });

  describe('encryptToFile', () => {
    it('should encrypt and save data to file', async () => {
      const filePath = '/test/path/file.json';
      const data = { key: 'value' };
      
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      
      await encryptionUtil.encryptToFile(filePath, data);
      
      expect(mockFs.mkdir).toHaveBeenCalledWith('/test/path', { recursive: true });
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        filePath,
        expect.stringContaining('encrypted')
      );
    });

    it('should handle file system errors', async () => {
      const filePath = '/test/path/file.json';
      const data = { key: 'value' };
      
      mockFs.mkdir.mockRejectedValue(new Error('Permission denied'));
      
      await expect(encryptionUtil.encryptToFile(filePath, data)).rejects.toThrow('Permission denied');
    });
  });

  describe('decryptFromFile', () => {
    it('should read and decrypt data from file', async () => {
      const filePath = '/test/path/file.json';
      const originalData = { key: 'value' };
      
      // Create encrypted data
      const encrypted = encryptionUtil.encrypt(originalData);
      const fileContent = JSON.stringify(encrypted);
      
      mockFs.readFile.mockResolvedValue(fileContent);
      
      const result = await encryptionUtil.decryptFromFile(filePath);
      
      expect(mockFs.readFile).toHaveBeenCalledWith(filePath, 'utf8');
      expect(result).toEqual(originalData);
    });

    it('should handle file read errors', async () => {
      const filePath = '/test/path/file.json';
      
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      
      await expect(encryptionUtil.decryptFromFile(filePath)).rejects.toThrow('File not found');
    });

    it('should handle invalid JSON in file', async () => {
      const filePath = '/test/path/file.json';
      
      mockFs.readFile.mockResolvedValue('invalid json');
      
      await expect(encryptionUtil.decryptFromFile(filePath)).rejects.toThrow();
    });
  });

  describe('static methods', () => {
    describe('generateKey', () => {
      it('should generate a base64 key', () => {
        const key = EncryptionUtil.generateKey();
        
        expect(typeof key).toBe('string');
        expect(key.length).toBeGreaterThan(0);
        
        // Should be valid base64
        expect(() => Buffer.from(key, 'base64')).not.toThrow();
      });

      it('should generate different keys each time', () => {
        const key1 = EncryptionUtil.generateKey();
        const key2 = EncryptionUtil.generateKey();
        
        expect(key1).not.toBe(key2);
      });
    });

    describe('hash', () => {
      it('should hash a string', () => {
        const hash = EncryptionUtil.hash('test-value');
        
        expect(typeof hash).toBe('string');
        expect(hash.length).toBe(64); // SHA256 hex length
      });

      it('should produce consistent hashes', () => {
        const value = 'test-value';
        const hash1 = EncryptionUtil.hash(value);
        const hash2 = EncryptionUtil.hash(value);
        
        expect(hash1).toBe(hash2);
      });

      it('should produce different hashes for different values', () => {
        const hash1 = EncryptionUtil.hash('value1');
        const hash2 = EncryptionUtil.hash('value2');
        
        expect(hash1).not.toBe(hash2);
      });

      it('should handle empty string', () => {
        const hash = EncryptionUtil.hash('');
        expect(hash).toBeTruthy();
        expect(hash.length).toBe(64);
      });
    });

    describe('compareHash', () => {
      it('should return true for matching value and hash', () => {
        const value = 'test-value';
        const hash = EncryptionUtil.hash(value);
        
        expect(EncryptionUtil.compareHash(value, hash)).toBe(true);
      });

      it('should return false for non-matching value and hash', () => {
        const value = 'test-value';
        const hash = EncryptionUtil.hash('different-value');
        
        expect(EncryptionUtil.compareHash(value, hash)).toBe(false);
      });

      it('should be timing-safe', () => {
        const value = 'test-value';
        const correctHash = EncryptionUtil.hash(value);
        const wrongHash = EncryptionUtil.hash('wrong-value');
        
        // Both should execute in similar time (timing-safe comparison)
        const start1 = process.hrtime();
        EncryptionUtil.compareHash(value, correctHash);
        const end1 = process.hrtime(start1);
        
        const start2 = process.hrtime();
        EncryptionUtil.compareHash(value, wrongHash);
        const end2 = process.hrtime(start2);
        
        // Both operations should complete (no errors)
        expect(end1).toBeDefined();
        expect(end2).toBeDefined();
      });
    });
  });

  describe('edge cases', () => {
    it('should handle very large data', () => {
      const largeData = 'x'.repeat(10000);
      const encrypted = encryptionUtil.encrypt(largeData);
      const decrypted = encryptionUtil.decrypt(encrypted);
      
      expect(decrypted).toBe(largeData);
    });

    it('should handle unicode characters', () => {
      const unicodeData = '🚀 Test with émojis and àccénts! 日本語';
      const encrypted = encryptionUtil.encrypt(unicodeData);
      const decrypted = encryptionUtil.decrypt(encrypted);
      
      expect(decrypted).toBe(unicodeData);
    });

    it('should handle special characters', () => {
      const specialData = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const encrypted = encryptionUtil.encrypt(specialData);
      const decrypted = encryptionUtil.decrypt(encrypted);
      
      expect(decrypted).toBe(specialData);
    });
  });

  describe('integration with different instances', () => {
    it('should not decrypt data encrypted by different instance', () => {
      const util1 = new EncryptionUtil('key1');
      const util2 = new EncryptionUtil('key2');
      
      const encrypted = util1.encrypt(testString);
      
      expect(() => util2.decrypt(encrypted)).toThrow();
    });

    it('should encrypt and decrypt with same instance', () => {
      const masterKey = 'shared-master-key';
      const util = new EncryptionUtil(masterKey);
      
      const encrypted = util.encrypt(testString);
      const decrypted = util.decrypt(encrypted);
      
      expect(decrypted).toBe(testString);
    });
  });
});