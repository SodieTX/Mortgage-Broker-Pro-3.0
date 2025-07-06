#!/usr/bin/env node

/**
 * Configuration CLI
 * Tool for managing application configuration and secrets
 */

import * as readline from 'readline';
import { ConfigService, initializeConfig } from '../config/config.service';
import { EncryptionUtil } from '../utils/encryption';
import * as fs from 'fs/promises';
import * as path from 'path';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function maskValue(value: string, showChars: number = 4): string {
  if (value.length <= showChars * 2) {
    return '*'.repeat(value.length);
  }
  return value.substring(0, showChars) + '*'.repeat(value.length - showChars * 2) + value.substring(value.length - showChars);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const environment = process.env.NODE_ENV || 'development';

  console.log(`\n🔧 Configuration Management Tool - ${environment} environment\n`);

  const configService = initializeConfig({
    environment: environment as any,
  });

  try {
    switch (command) {
      case 'get':
        await handleGet(configService, args[1]);
        break;
      
      case 'set':
        await handleSet(configService, args[1], args[2]);
        break;
      
      case 'delete':
        await handleDelete(configService, args[1]);
        break;
      
      case 'list':
        await handleList(configService);
        break;
      
      case 'encrypt':
        await handleEncrypt(args[1], args[2]);
        break;
      
      case 'decrypt':
        await handleDecrypt(args[1], args[2]);
        break;
      
      case 'generate-key':
        await handleGenerateKey();
        break;
      
      case 'validate':
        await handleValidate(configService);
        break;
      
      case 'migrate':
        await handleMigrate();
        break;
      
      default:
        showHelp();
    }
  } catch (error) {
    console.error(`\n❌ Error: ${error}`);
    process.exit(1);
  } finally {
    rl.close();
  }
}

async function handleGet(configService: ConfigService, key?: string) {
  if (!key) {
    console.error('Usage: config-cli get <key>');
    return;
  }

  const value = await configService.get(key);
  
  if (value === undefined) {
    console.log(`Key "${key}" not found`);
  } else {
    // Mask sensitive values
    const sensitiveKeys = ['password', 'secret', 'key', 'token'];
    const shouldMask = sensitiveKeys.some(k => key.toLowerCase().includes(k));
    
    if (shouldMask && typeof value === 'string') {
      console.log(`${key}: ${maskValue(value)}`);
      
      const showFull = await question('\nShow full value? (y/N): ');
      if (showFull.toLowerCase() === 'y') {
        console.log(`${key}: ${value}`);
      }
    } else {
      console.log(`${key}: ${JSON.stringify(value, null, 2)}`);
    }
  }
}

async function handleSet(configService: ConfigService, key?: string, value?: string) {
  if (!key) {
    console.error('Usage: config-cli set <key> <value>');
    return;
  }

  let finalValue: any = value;
  
  if (!value) {
    // Prompt for value (useful for secrets)
    const isSecret = ['password', 'secret', 'key', 'token'].some(k => key.toLowerCase().includes(k));
    
    if (isSecret) {
      // Hide input for secrets
      const hiddenValue = await question(`Enter value for ${key} (hidden): `);
      finalValue = hiddenValue;
    } else {
      finalValue = await question(`Enter value for ${key}: `);
    }
  }

  // Try to parse JSON values
  try {
    finalValue = JSON.parse(finalValue);
  } catch {
    // Keep as string if not valid JSON
  }

  await configService.set(key, finalValue);
  console.log(`✅ Set ${key} successfully`);
}

async function handleDelete(configService: ConfigService, key?: string) {
  if (!key) {
    console.error('Usage: config-cli delete <key>');
    return;
  }

  const confirm = await question(`Are you sure you want to delete "${key}"? (y/N): `);
  if (confirm.toLowerCase() !== 'y') {
    console.log('Cancelled');
    return;
  }

  await configService.delete(key);
  console.log(`✅ Deleted ${key} successfully`);
}

async function handleList(configService: ConfigService) {
  console.log('Fetching all configuration keys...\n');
  
  // Get complete config to show structure
  const config = await configService.getConfig();
  
  // Display configuration tree
  displayConfigTree(config);
}

function displayConfigTree(obj: any, prefix = '', isLast = true) {
  const entries = Object.entries(obj);
  entries.forEach(([key, value], index) => {
    const isLastEntry = index === entries.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const extension = isLast ? '    ' : '│   ';
    
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      console.log(prefix + connector + key);
      displayConfigTree(value, prefix + extension, isLastEntry);
    } else {
      // Mask sensitive values
      const sensitiveKeys = ['password', 'secret', 'key', 'token'];
      const shouldMask = sensitiveKeys.some(k => key.toLowerCase().includes(k));
      
      if (shouldMask && typeof value === 'string') {
        console.log(prefix + connector + key + ': ' + maskValue(value));
      } else {
        console.log(prefix + connector + key + ': ' + JSON.stringify(value));
      }
    }
  });
}

async function handleEncrypt(inputFile?: string, outputFile?: string) {
  if (!inputFile) {
    console.error('Usage: config-cli encrypt <input-file> [output-file]');
    return;
  }

  const output = outputFile || inputFile + '.encrypted';
  
  // Read encryption key
  const key = await question('Enter encryption key (or press enter for auto-generated): ');
  const encryption = new EncryptionUtil(key || undefined);
  
  // Read and encrypt file
  const content = await fs.readFile(inputFile, 'utf8');
  const data = JSON.parse(content);
  
  await encryption.encryptToFile(output, data);
  console.log(`✅ Encrypted configuration saved to ${output}`);
  
  if (!key) {
    console.log('\n⚠️  Auto-generated key used. This is derived from your environment.');
    console.log('For production, use a secure master key.');
  }
}

async function handleDecrypt(inputFile?: string, outputFile?: string) {
  if (!inputFile) {
    console.error('Usage: config-cli decrypt <input-file> [output-file]');
    return;
  }

  const output = outputFile || inputFile.replace('.encrypted', '.decrypted.json');
  
  // Read encryption key
  const key = await question('Enter encryption key (or press enter for auto-generated): ');
  const encryption = new EncryptionUtil(key || undefined);
  
  // Decrypt file
  const data = await encryption.decryptFromFile(inputFile);
  
  await fs.writeFile(output, JSON.stringify(data, null, 2));
  console.log(`✅ Decrypted configuration saved to ${output}`);
}

async function handleGenerateKey() {
  const key = EncryptionUtil.generateKey();
  console.log('\n🔑 Generated encryption key:');
  console.log(key);
  console.log('\n⚠️  Keep this key secure! Store it in a password manager or secure location.');
  console.log('You will need this key to decrypt your configuration files.');
}

async function handleValidate(configService: ConfigService) {
  console.log('Validating configuration...\n');
  
  try {
    const config = await configService.getConfig();
    console.log('✅ Configuration is valid!');
    
    // Check for security issues
    const warnings: string[] = [];
    
    if (config.jwt.secret === 'change-this-in-production' && config.environment === 'production') {
      warnings.push('JWT secret is using default value in production!');
    }
    
    if (config.database.password === '' || !config.database.password) {
      warnings.push('Database password is empty!');
    }
    
    if (!config.azure?.keyVault && config.environment === 'production') {
      warnings.push('Azure Key Vault not configured for production environment');
    }
    
    if (warnings.length > 0) {
      console.log('\n⚠️  Security warnings:');
      warnings.forEach(w => console.log(`   - ${w}`));
    }
    
  } catch (error) {
    console.error('❌ Configuration validation failed:');
    console.error(error);
  }
}

async function handleMigrate() {
  console.log('Migrating configuration from .env files...\n');
  
  const envFiles = ['.env', '.env.azure'];
  const config: any = {};
  
  // Read all env files
  for (const file of envFiles) {
    try {
      const content = await fs.readFile(file, 'utf8');
      const lines = content.split('\n');
      
      for (const line of lines) {
        if (line.trim() && !line.startsWith('#')) {
          const [key, ...valueParts] = line.split('=');
          const value = valueParts.join('=').trim();
          
          // Convert env key to config key
          const configKey = key.toLowerCase().replace(/_/g, '.');
          setNestedValue(config, configKey, value);
        }
      }
      
      console.log(`✅ Read ${file}`);
    } catch (error) {
      console.log(`⚠️  Could not read ${file}`);
    }
  }
  
  // Save to config file
  const outputFile = path.join('config', 'config.development.json');
  await fs.mkdir('config', { recursive: true });
  await fs.writeFile(outputFile, JSON.stringify(config, null, 2));
  
  console.log(`\n✅ Configuration migrated to ${outputFile}`);
  console.log('\n⚠️  Remember to:');
  console.log('   1. Review the migrated configuration');
  console.log('   2. Encrypt sensitive values');
  console.log('   3. Remove secrets from .env files');
}

function setNestedValue(obj: any, path: string, value: any) {
  const parts = path.split('.');
  let current = obj;
  
  for (let i = 0; i < parts.length - 1; i++) {
    if (!(parts[i] in current)) {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }
  
  // Parse value
  if (value.toLowerCase() === 'true') {
    current[parts[parts.length - 1]] = true;
  } else if (value.toLowerCase() === 'false') {
    current[parts[parts.length - 1]] = false;
  } else if (/^\d+$/.test(value)) {
    current[parts[parts.length - 1]] = parseInt(value, 10);
  } else {
    current[parts[parts.length - 1]] = value;
  }
}

function showHelp() {
  console.log(`
Configuration Management CLI

Usage: config-cli <command> [options]

Commands:
  get <key>                 Get a configuration value
  set <key> [value]         Set a configuration value
  delete <key>              Delete a configuration value
  list                      List all configuration keys
  encrypt <file> [output]   Encrypt a configuration file
  decrypt <file> [output]   Decrypt a configuration file
  generate-key              Generate a secure encryption key
  validate                  Validate current configuration
  migrate                   Migrate from .env files to config

Examples:
  config-cli get database.host
  config-cli set jwt.secret
  config-cli encrypt config/config.json
  config-cli generate-key

Environment:
  NODE_ENV=${process.env.NODE_ENV || 'development'}
`);
}

// Run the CLI
main().catch(console.error);
