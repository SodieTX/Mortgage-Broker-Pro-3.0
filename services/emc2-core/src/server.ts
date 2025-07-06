/**
 * Fastify Server Setup
 * 
 * Simple, fast, and maintainable
 */

import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { logger } from './utils/logger';
import { healthRoutes } from './routes/health';
import { scenarioRoutes } from './routes/scenarios';
import { calculationRoutes } from './routes/calculations';
import { authRoutes } from './routes/auth';
import reportRoutes from './routes/reportRoutes';
import { getDatabase } from './db/connection';

export async function createServer() {
  // Create Fastify instance with our logger
  const server = Fastify({
    logger: logger,
    trustProxy: true
  });
  
  // Register JWT plugin
  await server.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production'
  });
  
  // Add authenticate decorator
  server.decorate('authenticate', async function(request: any, reply: any) {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });
  
  // Register health check routes
  await server.register(healthRoutes);
  
  // Register scenario routes with prefix
  await server.register(scenarioRoutes, { prefix: '/api/v1' });
  
  // Register calculation routes with prefix
  await server.register(calculationRoutes, { prefix: '/api/v1' });
  
  // Register auth routes
  await server.register(authRoutes, { prefix: '/api/v1' });
  
  // Register report routes
  await server.register(reportRoutes);
  
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
