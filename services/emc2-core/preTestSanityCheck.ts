// preTestSanityCheck.ts
// Jest global setup to check DB/Redis before running tests

import * as path from 'path';
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const { Pool } = require('pg');
const Redis = require('ioredis');

module.exports = async () => {
  console.log('DB_USER:', process.env.DB_USER);
  console.log('DB_PASSWORD:', typeof process.env.DB_PASSWORD === 'string' ? '*'.repeat(process.env.DB_PASSWORD.length) : process.env.DB_PASSWORD);
  console.log('DB_NAME:', process.env.DB_NAME);
  console.log('DB_HOST:', process.env.DB_HOST);
  console.log('DB_PORT:', process.env.DB_PORT);
  console.log('POSTGRES_USER:', process.env.POSTGRES_USER);
  console.log('POSTGRES_PASSWORD:', typeof process.env.POSTGRES_PASSWORD === 'string' ? '*'.repeat(process.env.POSTGRES_PASSWORD.length) : process.env.POSTGRES_PASSWORD);
  console.log('POSTGRES_DB:', process.env.POSTGRES_DB);

  // Build Postgres config if no connection string is provided
  let pgConfig: any = {};
  if (process.env.TEST_DATABASE_URL || process.env.DATABASE_URL) {
    pgConfig.connectionString = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  } else {
    pgConfig = {
      user: process.env.DB_USER || process.env.POSTGRES_USER,
      password: String(process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || ''),
      database: process.env.DB_NAME || process.env.POSTGRES_DB,
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 5432),
    };
  }
  const db = new Pool(pgConfig);
  const redis = new Redis(process.env.TEST_REDIS_URL || 'redis://localhost:6379');
  try {
    await db.query('SELECT 1');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error('Cannot connect to Postgres: ' + message);
  }
  try {
    const pong = await redis.ping();
    if (pong !== 'PONG') throw new Error('Redis did not respond with PONG');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error('Cannot connect to Redis: ' + message);
  }
  await db.end();
  await redis.quit();
};
