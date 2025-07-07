/**
 * Tests for configuration types and schemas
 * Tests all Zod schemas validation
 */

import {
  DatabaseConfigSchema,
  RedisConfigSchema,
  JwtConfigSchema,
  AzureStorageConfigSchema,
  EmailConfigSchema,
  ApiConfigSchema,
  AzureKeyVaultConfigSchema,
  AppConfigSchema,
  type DatabaseConfig,
  type ConfigSource,
  type SecretMetadata,
  type IConfigProvider,
} from '../config.types';

describe('Configuration Types', () => {
  describe('DatabaseConfigSchema', () => {
    it('should validate valid database config', () => {
      const validConfig = {
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'testuser',
        password: 'testpass',
        ssl: true,
        poolSize: 15
      };

      const result = DatabaseConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validConfig);
      }
    });

    it('should apply defaults for optional fields', () => {
      const config = {
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'testuser',
        password: 'testpass'
      };

      const result = DatabaseConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.ssl).toBe(false);
        expect(result.data.poolSize).toBe(10);
      }
    });

    it('should reject invalid port ranges', () => {
      const invalidConfig = {
        host: 'localhost',
        port: 70000, // Invalid port
        database: 'testdb',
        username: 'testuser',
        password: 'testpass'
      };

      const result = DatabaseConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('should reject invalid poolSize', () => {
      const invalidConfig = {
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'testuser',
        password: 'testpass',
        poolSize: 150 // Too large
      };

      const result = DatabaseConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const invalidConfig = {
        host: 'localhost',
        port: 5432,
        // Missing database, username, password
      };

      const result = DatabaseConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });
  });

  describe('RedisConfigSchema', () => {
    it('should validate valid redis config', () => {
      const validConfig = {
        host: 'localhost',
        port: 6379,
        password: 'redispass',
        db: 1,
        keyPrefix: 'emc2:'
      };

      const result = RedisConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validConfig);
      }
    });

    it('should apply defaults for optional fields', () => {
      const config = {
        host: 'localhost',
        port: 6379
      };

      const result = RedisConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.db).toBe(0);
      }
    });

    it('should reject invalid db number', () => {
      const invalidConfig = {
        host: 'localhost',
        port: 6379,
        db: 20 // Invalid db number
      };

      const result = RedisConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });
  });

  describe('JwtConfigSchema', () => {
    it('should validate valid JWT config', () => {
      const validConfig = {
        secret: 'this-is-a-very-long-secret-key-for-jwt-signing',
        accessTokenExpiry: '30m',
        refreshTokenExpiry: '14d',
        issuer: 'emc2-core'
      };

      const result = JwtConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validConfig);
      }
    });

    it('should apply defaults for token expiry', () => {
      const config = {
        secret: 'this-is-a-very-long-secret-key-for-jwt-signing'
      };

      const result = JwtConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.accessTokenExpiry).toBe('15m');
        expect(result.data.refreshTokenExpiry).toBe('7d');
      }
    });

    it('should reject short secrets', () => {
      const invalidConfig = {
        secret: 'short' // Too short
      };

      const result = JwtConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });
  });

  describe('AzureStorageConfigSchema', () => {
    it('should validate valid Azure Storage config', () => {
      const validConfig = {
        connectionString: 'DefaultEndpointsProtocol=https;AccountName=test;AccountKey=key;EndpointSuffix=core.windows.net',
        accountName: 'testaccount',
        accountKey: 'testkey',
        sasToken: 'sastoken'
      };

      const result = AzureStorageConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validConfig);
      }
    });

    it('should require connection string', () => {
      const invalidConfig = {
        accountName: 'testaccount'
      };

      const result = AzureStorageConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });
  });

  describe('EmailConfigSchema', () => {
    it('should validate valid email config with SendGrid', () => {
      const validConfig = {
        provider: 'sendgrid' as const,
        apiKey: 'sg.test.key',
        domain: 'example.com',
        from: {
          name: 'EMC2 Core',
          email: 'noreply@example.com'
        }
      };

      const result = EmailConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validConfig);
      }
    });

    it('should validate valid email config with SMTP', () => {
      const validConfig = {
        provider: 'smtp' as const,
        from: {
          name: 'EMC2 Core',
          email: 'noreply@example.com'
        },
        smtp: {
          host: 'smtp.example.com',
          port: 587,
          secure: true,
          username: 'smtpuser',
          password: 'smtppass'
        }
      };

      const result = EmailConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validConfig);
      }
    });

    it('should reject invalid email providers', () => {
      const invalidConfig = {
        provider: 'invalid-provider',
        from: {
          name: 'EMC2 Core',
          email: 'noreply@example.com'
        }
      };

      const result = EmailConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('should reject invalid from email', () => {
      const invalidConfig = {
        provider: 'sendgrid' as const,
        from: {
          name: 'EMC2 Core',
          email: 'invalid-email' // Invalid email format
        }
      };

      const result = EmailConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });
  });

  describe('ApiConfigSchema', () => {
    it('should validate valid API config', () => {
      const validConfig = {
        port: 8080,
        host: '127.0.0.1',
        corsOrigin: 'https://example.com',
        rateLimit: {
          windowMs: 900000,
          max: 200
        },
        apiKeys: ['key1', 'key2']
      };

      const result = ApiConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validConfig);
      }
    });

    it('should apply defaults', () => {
      const config = {};

      const result = ApiConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.port).toBe(3001);
        expect(result.data.host).toBe('0.0.0.0');
      }
    });

    it('should accept array of CORS origins', () => {
      const config = {
        corsOrigin: ['https://example.com', 'https://test.com']
      };

      const result = ApiConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.corsOrigin).toEqual(['https://example.com', 'https://test.com']);
      }
    });

    it('should reject invalid port', () => {
      const invalidConfig = {
        port: 0 // Invalid port
      };

      const result = ApiConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });
  });

  describe('AzureKeyVaultConfigSchema', () => {
    it('should validate valid Key Vault config', () => {
      const validConfig = {
        vaultUrl: 'https://test-vault.vault.azure.net/',
        clientId: 'client-id',
        clientSecret: 'client-secret',
        tenantId: 'tenant-id',
        useManagedIdentity: true
      };

      const result = AzureKeyVaultConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validConfig);
      }
    });

    it('should apply defaults', () => {
      const config = {
        vaultUrl: 'https://test-vault.vault.azure.net/'
      };

      const result = AzureKeyVaultConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.useManagedIdentity).toBe(false);
      }
    });

    it('should reject invalid vault URL', () => {
      const invalidConfig = {
        vaultUrl: 'not-a-url'
      };

      const result = AzureKeyVaultConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });
  });

  describe('AppConfigSchema', () => {
    it('should validate complete app config', () => {
      const validConfig = {
        environment: 'development' as const,
        database: {
          host: 'localhost',
          port: 5432,
          database: 'testdb',
          username: 'testuser',
          password: 'testpass'
        },
        redis: {
          host: 'localhost',
          port: 6379
        },
        jwt: {
          secret: 'this-is-a-very-long-secret-key-for-jwt-signing'
        },
        azure: {
          storage: {
            connectionString: 'DefaultEndpointsProtocol=https;AccountName=test;AccountKey=key;EndpointSuffix=core.windows.net'
          },
          keyVault: {
            vaultUrl: 'https://test-vault.vault.azure.net/'
          }
        },
        email: {
          provider: 'sendgrid' as const,
          apiKey: 'sg.test.key',
          from: {
            name: 'EMC2 Core',
            email: 'noreply@example.com'
          }
        },
        api: {
          port: 8080,
          host: '127.0.0.1'
        },
        features: {
          enableEmailTracking: true,
          enableDocumentUpload: false,
          enableReporting: true
        }
      };

      const result = AppConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        // Check that all required fields exist and defaults are applied
        expect(result.data.environment).toBe('development');
        expect(result.data.database.host).toBe('localhost');
        expect(result.data.database.ssl).toBe(false); // Default applied
        expect(result.data.database.poolSize).toBe(10); // Default applied
        expect(result.data.redis?.db).toBe(0); // Default applied
        expect(result.data.jwt.accessTokenExpiry).toBe('15m'); // Default applied
        expect(result.data.jwt.refreshTokenExpiry).toBe('7d'); // Default applied
        expect(result.data.azure?.keyVault?.useManagedIdentity).toBe(false); // Default applied
      }
    });

    it('should validate minimal app config', () => {
      const minimalConfig = {
        environment: 'production' as const,
        database: {
          host: 'localhost',
          port: 5432,
          database: 'testdb',
          username: 'testuser',
          password: 'testpass'
        },
        jwt: {
          secret: 'this-is-a-very-long-secret-key-for-jwt-signing'
        },
        api: {}
      };

      const result = AppConfigSchema.safeParse(minimalConfig);
      expect(result.success).toBe(true);
    });

    it('should reject invalid environment', () => {
      const invalidConfig = {
        environment: 'invalid-env',
        database: {
          host: 'localhost',
          port: 5432,
          database: 'testdb',
          username: 'testuser',
          password: 'testpass'
        },
        jwt: {
          secret: 'this-is-a-very-long-secret-key-for-jwt-signing'
        },
        api: {}
      };

      const result = AppConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });
  });

  describe('Type exports', () => {
    it('should export all expected types', () => {
      // Test that types are properly exported and can be used
      const configSource: ConfigSource = 'env';
      expect(configSource).toBe('env');

      const secretMetadata: SecretMetadata = {
        key: 'test-key',
        version: '1.0',
        source: 'env',
        lastUpdated: new Date(),
        expiresAt: new Date()
      };
      expect(secretMetadata.key).toBe('test-key');
    });

    it('should validate type inference', () => {
      // Test that types are correctly inferred from schemas
      const dbConfig: DatabaseConfig = {
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'testuser',
        password: 'testpass',
        ssl: false,
        poolSize: 10
      };

      expect(dbConfig.host).toBe('localhost');
      expect(dbConfig.ssl).toBe(false);
    });
  });

  describe('Interface types', () => {
    it('should define IConfigProvider interface correctly', () => {
      // Test that the interface structure is correct
      class MockConfigProvider implements IConfigProvider {
        async get<T = string>(_key: string): Promise<T | undefined> {
          return undefined;
        }

        async getRequired<T = string>(_key: string): Promise<T> {
          return 'value' as T;
        }

        async set(_key: string, _value: any): Promise<void> {
          // Mock implementation
        }

        async delete(_key: string): Promise<void> {
          // Mock implementation
        }

        async list(): Promise<string[]> {
          return [];
        }

        async refresh(): Promise<void> {
          // Mock implementation
        }
      }

      const provider = new MockConfigProvider();
      expect(provider).toBeDefined();
      expect(typeof provider.get).toBe('function');
      expect(typeof provider.getRequired).toBe('function');
      expect(typeof provider.set).toBe('function');
      expect(typeof provider.delete).toBe('function');
      expect(typeof provider.list).toBe('function');
      expect(typeof provider.refresh).toBe('function');
    });
  });

  describe('Schema validation edge cases', () => {
    it('should handle empty objects', () => {
      const result = DatabaseConfigSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should handle null values', () => {
      const result = DatabaseConfigSchema.safeParse(null);
      expect(result.success).toBe(false);
    });

    it('should handle undefined values', () => {
      const result = DatabaseConfigSchema.safeParse(undefined);
      expect(result.success).toBe(false);
    });

    it('should handle string values for numeric fields', () => {
      const configWithStringPort = {
        host: 'localhost',
        port: '5432', // String instead of number
        database: 'testdb',
        username: 'testuser',
        password: 'testpass'
      };

      const result = DatabaseConfigSchema.safeParse(configWithStringPort);
      expect(result.success).toBe(false);
    });
  });
});