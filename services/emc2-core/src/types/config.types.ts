/**
 * Configuration types for the application
 * Defines all configuration schemas with Zod validation
 */

import { z } from 'zod';

// Database configuration schema
export const DatabaseConfigSchema = z.object({
  host: z.string(),
  port: z.number().min(1).max(65535),
  database: z.string(),
  username: z.string(),
  password: z.string(),
  ssl: z.boolean().optional().default(false),
  poolSize: z.number().min(1).max(100).optional().default(10),
});

// Redis configuration schema
export const RedisConfigSchema = z.object({
  host: z.string(),
  port: z.number().min(1).max(65535),
  password: z.string().optional(),
  db: z.number().min(0).max(15).optional().default(0),
  keyPrefix: z.string().optional(),
});

// JWT configuration schema
export const JwtConfigSchema = z.object({
  secret: z.string().min(32),
  accessTokenExpiry: z.string().default('15m'),
  refreshTokenExpiry: z.string().default('7d'),
  issuer: z.string().optional(),
});

// Azure Storage configuration schema
export const AzureStorageConfigSchema = z.object({
  connectionString: z.string(),
  accountName: z.string().optional(),
  accountKey: z.string().optional(),
  sasToken: z.string().optional(),
});

// Email configuration schema
export const EmailConfigSchema = z.object({
  provider: z.enum(['sendgrid', 'mailgun', 'ses', 'smtp']),
  apiKey: z.string().optional(),
  domain: z.string().optional(),
  from: z.object({
    name: z.string(),
    email: z.string().email(),
  }),
  smtp: z.object({
    host: z.string(),
    port: z.number(),
    secure: z.boolean(),
    username: z.string(),
    password: z.string(),
  }).optional(),
});

// API configuration schema
export const ApiConfigSchema = z.object({
  port: z.number().min(1).max(65535).default(3001),
  host: z.string().default('0.0.0.0'),
  corsOrigin: z.string().or(z.array(z.string())).optional(),
  rateLimit: z.object({
    windowMs: z.number().default(15 * 60 * 1000), // 15 minutes
    max: z.number().default(100),
  }).optional(),
  apiKeys: z.array(z.string()).optional(),
});

// Azure Key Vault configuration schema
export const AzureKeyVaultConfigSchema = z.object({
  vaultUrl: z.string().url(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  tenantId: z.string().optional(),
  useManagedIdentity: z.boolean().default(false),
});

// Complete application configuration schema
export const AppConfigSchema = z.object({
  environment: z.enum(['development', 'staging', 'production']),
  database: DatabaseConfigSchema,
  redis: RedisConfigSchema.optional(),
  jwt: JwtConfigSchema,
  azure: z.object({
    storage: AzureStorageConfigSchema.optional(),
    keyVault: AzureKeyVaultConfigSchema.optional(),
  }).optional(),
  email: EmailConfigSchema.optional(),
  api: ApiConfigSchema,
  features: z.object({
    enableEmailTracking: z.boolean().default(true),
    enableDocumentUpload: z.boolean().default(true),
    enableReporting: z.boolean().default(true),
  }).optional(),
});

// Type exports
export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;
export type RedisConfig = z.infer<typeof RedisConfigSchema>;
export type JwtConfig = z.infer<typeof JwtConfigSchema>;
export type AzureStorageConfig = z.infer<typeof AzureStorageConfigSchema>;
export type EmailConfig = z.infer<typeof EmailConfigSchema>;
export type ApiConfig = z.infer<typeof ApiConfigSchema>;
export type AzureKeyVaultConfig = z.infer<typeof AzureKeyVaultConfigSchema>;
export type AppConfig = z.infer<typeof AppConfigSchema>;

// Configuration source types
export type ConfigSource = 'env' | 'file' | 'keyvault' | 'default';

// Secret metadata
export interface SecretMetadata {
  key: string;
  version?: string;
  source: ConfigSource;
  lastUpdated: Date;
  expiresAt?: Date;
}

// Configuration provider interface
export interface IConfigProvider {
  get<T = string>(key: string): Promise<T | undefined>;
  getRequired<T = string>(key: string): Promise<T>;
  set(key: string, value: any): Promise<void>;
  delete(key: string): Promise<void>;
  list(): Promise<string[]>;
  refresh(): Promise<void>;
}
