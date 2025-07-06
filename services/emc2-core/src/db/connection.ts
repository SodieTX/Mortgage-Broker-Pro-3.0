/**
 * Database Connection Manager
 * 
 * Simple connection pooling with pg
 */

import { Pool } from 'pg';
import { logger } from '../utils/logger';

let pool: Pool | null = null;

export async function getDatabase(): Promise<Pool> {
  if (!pool) {
    pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'mortgage_broker_pro',
      user: process.env.DB_USER || 'mortgage_user',
      password: process.env.DB_PASSWORD || 'mortgage_pass',
      max: 10, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
    });
    
    // Handle pool errors
    pool.on('error', (err) => {
      logger.error('Unexpected database pool error:', err);
    });
  }
  
  return pool;
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database connection pool closed');
  }
}
