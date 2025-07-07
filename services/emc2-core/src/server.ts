/**
 * Fastify Server Setup
 * 
 * Production-ready with security, rate limiting, and auth middleware
 */

import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { logger } from './utils/logger';
import { healthRoutes } from './routes/health';
import { scenarioRoutes } from './routes/scenarios';
import { calculationRoutes } from './routes/calculations';
import { authRoutes } from './routes/auth';
import reportRoutes from './routes/reportRoutes';
import emailRoutes from './routes/emailRoutes';
import taskRoutes from './routes/taskRoutes';
import { documentRoutes } from './routes/documents';
import lenderRoutes from './routes/lenders';
import { taskQueueService } from './services/taskQueueService';
import { getDatabase } from './db/connection';
import { Redis } from 'ioredis';
import { AuthService } from './services/authService';
import { RBACService } from './services/rbacService';
import { initializeAuthMiddleware } from './middleware/auth';
import { applySecurity } from './middleware/security';

export async function createServer() {
  try {
    logger.info('Creating server...');
    // Create Fastify instance with our logger
    const server = Fastify({
      logger: logger,
      trustProxy: true
    });
  
  // Apply comprehensive security middleware
  logger.debug('Applying security middleware...');
  await applySecurity(server as any, {
    cors: {
      origin: process.env.CORS_ORIGIN?.split(',') || true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
    },
    rateLimit: {
      global: 100,
      auth: 5,
      api: 1000
    },
    xss: true
  });
  logger.debug('Security middleware applied');
  
  // Register multipart support for file uploads
  const multipart = await import('@fastify/multipart');
  await server.register(multipart.default, {
    limits: {
      fileSize: 10 * 1024 * 1024 // 10MB
    }
  });
  
  // Register JWT plugin
  await server.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    sign: {
      expiresIn: '15m'
    }
  });
  
  // Initialize auth services
  logger.debug('Getting database connection...');
  const db = await getDatabase();
  logger.debug('Database obtained');
  
  let redis: Redis | null = null;
  let authService: AuthService | null = null;
  
  try {
    logger.debug('Attempting Redis connection...');
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD,
      retryStrategy: (times: number) => {
        if (times > 3) {
          logger.error('Redis connection failed after 3 attempts. Running without Redis.');
          return null;
        }
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      enableOfflineQueue: false,
      lazyConnect: true
    });
    
    await redis.connect();
    logger.info('Redis connected successfully');
    
    authService = new AuthService(db, redis);
  } catch (error) {
    logger.warn('Redis connection failed. Auth features will be limited.', error);
  }
  
  const rbacService = new RBACService(db);
  
  // Initialize auth middleware only if Redis is available
  if (authService) {
    initializeAuthMiddleware(server as any, authService, rbacService);
  } else {
    // Add basic auth middleware without Redis features
    server.decorate('authenticate', async function(request: any, reply: any) {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.code(401).send({ success: false, error: 'Unauthorized' });
      }
    });
    
    server.decorate('authorize', function(_resource: string, _action: string) {
      return async function(_request: any, reply: any) {
        reply.code(503).send({ 
          success: false, 
          error: 'Authorization service unavailable (Redis required)' 
        });
      };
    });
    
    server.decorate('optionalAuth', async function(request: any, _reply: any) {
      try {
        if (request.headers.authorization) {
          await request.jwtVerify();
        }
      } catch (err) {
        // Silent fail for optional auth
      }
    });
  }
  
  // Additional security headers are now handled by the security middleware
  
  // Register health check routes (no auth required)
  await server.register(healthRoutes);
  
  // Register auth routes
  await server.register(authRoutes, { prefix: '/api/v1' });
  
  // Register protected routes with prefix
  await server.register(scenarioRoutes, { prefix: '/api/v1' });
  await server.register(calculationRoutes, { prefix: '/api/v1' });
  await server.register(documentRoutes, { prefix: '/api/v1' });
  await server.register(lenderRoutes, { prefix: '/api/v1' });
  await server.register(reportRoutes);
  await server.register(emailRoutes);
  await server.register(taskRoutes);
  
  // Add a simple root route
  server.get('/', async () => {
    return { 
      service: 'EMC² Core',
      version: '0.0.1',
      status: 'operational',
      security: 'enabled'
    };
  });
  
  // Error handler
  server.setErrorHandler((error, request, reply) => {
    logger.error({
      err: error,
      request: {
        method: request.method,
        url: request.url,
        headers: request.headers,
        params: request.params,
        query: request.query
      }
    }, 'Request error');
    
    // Don't expose internal errors
    if (error.statusCode === 429) {
      reply.code(429).send({
        success: false,
        error: 'Too many requests'
      });
      return;
    }
    
    const statusCode = error.statusCode || 500;
    const message = statusCode < 500 ? error.message : 'Internal server error';
    
    reply.code(statusCode).send({
      success: false,
      error: message
    });
  });
  
  // Test database connection on startup
  server.addHook('onReady', async () => {
    try {
      const db = await getDatabase();
      await db.query('SELECT 1');
      logger.info('Database connection verified');
      
      // Test Redis connection if available
      if (redis) {
        try {
          await redis.ping();
          logger.info('Redis connection verified');
          
          // Initialize task queue service
          try {
            await taskQueueService.initialize();
            logger.info('Task queue service initialized');
          } catch (taskError) {
            logger.warn('Task queue service failed to initialize:', taskError);
          }
          
          // Initialize email monitoring service (requires Redis)
          try {
            const { emailMonitoringService } = await import('./services/emailMonitoringService');
            emailMonitoringService.initialize();
            logger.info('Email monitoring service initialized');
          } catch (emailError) {
            logger.warn('Email monitoring service failed to initialize:', emailError);
          }
        } catch (redisError) {
          logger.warn('Redis ping failed, but continuing:', redisError);
        }
      } else {
        logger.warn('Running without Redis - auth features and task queues limited');
      }
    } catch (error) {
      logger.error('Service dependency check failed:', error);
      logger.error('Error type:', typeof error);
      if (error instanceof Error) {
        logger.error('Error message:', error.message);
        logger.error('Error stack:', error.stack);
      }
      throw error;
    }
  });
  
  // Graceful shutdown
  server.addHook('onClose', async () => {
    if (redis) {
      await redis.quit();
      logger.info('Redis connection closed');
    }
  });
  
  return server;
  } catch (error) {
    logger.error('Server creation error:', error);
    throw error;
  }
}
