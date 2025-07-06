#!/usr/bin/env node
/**
 * Dependency Check Script
 * 
 * Verifies all required services are available before starting
 */

const { Pool } = require('pg');
const Redis = require('ioredis');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
const envPath = process.env.NODE_ENV === 'production' 
  ? '.env' 
  : '.env.development';

dotenv.config({ path: envPath });

const checks = {
  database: false,
  redis: false,
  smtp: false,
  environment: false
};

async function checkDatabase() {
  console.log('🔍 Checking PostgreSQL connection...');
  
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'mortgage_broker_dev',
    connectionTimeoutMillis: 5000
  });
  
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('✅ PostgreSQL connected:', result.rows[0].now);
    
    // Check if auth schema exists
    const schemaResult = await pool.query(
      `SELECT EXISTS(
        SELECT 1 FROM information_schema.schemata 
        WHERE schema_name = 'auth'
      )`
    );
    
    if (!schemaResult.rows[0].exists) {
      console.log('⚠️  Auth schema not found. Run: npm run db:setup');
      return false;
    }
    
    checks.database = true;
    return true;
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error.message);
    console.log('   Make sure PostgreSQL is running and database exists');
    console.log('   Run: npm run db:setup');
    return false;
  } finally {
    await pool.end();
  }
}

async function checkRedis() {
  console.log('\n🔍 Checking Redis connection...');
  
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    connectTimeout: 5000,
    lazyConnect: true
  });
  
  try {
    await redis.connect();
    await redis.ping();
    console.log('✅ Redis connected');
    checks.redis = true;
    return true;
  } catch (error) {
    console.log('⚠️  Redis connection failed:', error.message);
    console.log('   Redis is optional but recommended for:');
    console.log('   - Session management');
    console.log('   - Rate limiting');
    console.log('   - Email queuing');
    console.log('   The app will work without it, but with reduced functionality');
    return false;
  } finally {
    redis.disconnect();
  }
}

async function checkSMTP() {
  console.log('\n🔍 Checking SMTP configuration...');
  
  const smtpConfig = {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  };
  
  const missing = [];
  for (const [key, value] of Object.entries(smtpConfig)) {
    if (!value) missing.push(`SMTP_${key.toUpperCase()}`);
  }
  
  if (missing.length > 0) {
    console.log('⚠️  SMTP configuration incomplete');
    console.log('   Missing:', missing.join(', '));
    console.log('   Emails will not be sent');
    console.log('   See .env.example for configuration instructions');
    return false;
  }
  
  console.log('✅ SMTP configuration present');
  console.log('   Host:', smtpConfig.host);
  console.log('   Port:', smtpConfig.port);
  console.log('   User:', smtpConfig.user);
  checks.smtp = true;
  return true;
}

async function checkEnvironment() {
  console.log('\n🔍 Checking environment variables...');
  
  const required = [
    'JWT_SECRET',
    'DATABASE_URL',
    'APP_URL',
    'FRONTEND_URL'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.log('❌ Required environment variables missing:', missing.join(', '));
    return false;
  }
  
  // Check JWT secret strength
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    console.log('⚠️  JWT_SECRET is too short (minimum 32 characters)');
    if (process.env.NODE_ENV === 'production') {
      console.log('❌ Weak JWT secret in production is not allowed');
      return false;
    }
  }
  
  console.log('✅ Environment variables configured');
  checks.environment = true;
  return true;
}

async function checkAll() {
  console.log('🚀 EMC2-Core Dependency Check');
  console.log('=============================');
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}\n`);
  
  // Run all checks
  await checkEnvironment();
  await checkDatabase();
  await checkRedis();
  await checkSMTP();
  
  console.log('\n📊 Summary:');
  console.log('===========');
  
  const allPassed = Object.values(checks).every(v => v);
  const criticalPassed = checks.database && checks.environment;
  
  for (const [service, status] of Object.entries(checks)) {
    console.log(`${status ? '✅' : '❌'} ${service.charAt(0).toUpperCase() + service.slice(1)}`);
  }
  
  if (allPassed) {
    console.log('\n✅ All checks passed! Ready to start.');
    process.exit(0);
  } else if (criticalPassed) {
    console.log('\n⚠️  Some optional services are unavailable.');
    console.log('The application can start but with reduced functionality.');
    process.exit(0);
  } else {
    console.log('\n❌ Critical services are not available.');
    console.log('Please fix the issues above before starting.');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  checkAll().catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
}

module.exports = { checkDatabase, checkRedis, checkSMTP, checkEnvironment };
