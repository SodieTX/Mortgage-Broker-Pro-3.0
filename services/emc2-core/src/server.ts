/**
 * Fastify Server Setup
 * 
 * Simple, fast, and maintainable
 */

import Fastify from 'fastify';
import { logger } from './utils/logger';
import { healthRoutes } from './routes/health';
import { getDatabase } from './db/connection';

export async function createServer() {
  // Create Fastify instance with our logger
  const server = Fastify({
    logger: logger,
    trustProxy: true
  });
  
  // Register health check routes
  await server.register(healthRoutes);
  
  // Add a simple root route
  server.get('/', async () => {
    return { 
      service: 'EMC² Core',
      version: '0.0.1',
      status: 'operational'
    };
  });
  
  // Test database connection on startup
  server.addHook('onReady', async () => {
    try {
      const db = await getDatabase();
      await db.query('SELECT 1');
      logger.info('Database connection verified');
    } catch (error) {
      logger.error('Database connection failed:', error);
      throw error;
    }
  });
  
  return server;
}
