/**
 * Health Check Routes
 * 
 * Production-ready health checks with comprehensive dependency monitoring
 */

import { FastifyPluginAsync } from 'fastify';
import { getDatabase } from '../db/connection';
import { Redis } from 'ioredis';
import { taskQueueService } from '../services/taskQueueService';

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  // Basic health check - fast and lightweight for load balancers
  fastify.get('/health', async (_request, reply) => {
    const checks: any = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'unknown',
        redis: 'unknown',
        queues: 'unknown'
      }
    };

    let overallHealth = true;

    // Test database connection
    try {
      const db = await getDatabase();
      await db.query('SELECT 1');
      checks.services.database = 'healthy';
    } catch (error) {
      checks.services.database = 'unhealthy';
      overallHealth = false;
    }

    // Test Redis connection
    try {
      const redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD,
        lazyConnect: true,
        maxRetriesPerRequest: 1
      });
      
      await redis.ping();
      checks.services.redis = 'healthy';
      redis.disconnect();
    } catch (error) {
      checks.services.redis = 'unhealthy';
      // Redis failure is not critical - service can run in degraded mode
    }

    // Test queue system
    try {
      await taskQueueService.getQueueStats();
      checks.services.queues = 'healthy';
    } catch (error) {
      checks.services.queues = 'unhealthy';
      // Queue failure is not critical - can fallback to sync processing
    }

    if (!overallHealth) {
      reply.code(503);
      checks.status = 'unhealthy';
    }

    return checks;
  });

  // Detailed readiness check for Kubernetes/orchestration
  fastify.get('/health/ready', async (_request, reply) => {
    const readiness: any = {
      status: 'ready',
      timestamp: new Date().toISOString(),
      checks: {
        database: { status: 'unknown', tables: 0 },
        redis: { status: 'unknown', connected: false },
        queues: { status: 'unknown', initialized: false },
        auth_schema: { status: 'unknown', tables: [] }
      }
    };

    let isReady = true;

    try {
      // Test database connection and schema
      const db = await getDatabase();
      const result = await db.query('SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = $1', ['public']);
      const authResult = await db.query('SELECT table_name FROM information_schema.tables WHERE table_schema = $1', ['auth']);
      
      const tableCount = parseInt(result.rows[0].count);
      const authTables = authResult.rows.map(row => row.table_name);
      
      readiness.checks.database = {
        status: 'ready',
        tables: tableCount,
        connection: 'ok'
      };
      
      readiness.checks.auth_schema = {
        status: authTables.length >= 8 ? 'ready' : 'incomplete',
        tables: authTables
      };
      
      if (tableCount === 0 || authTables.length < 8) {
        isReady = false;
      }
    } catch (error) {
      readiness.checks.database.status = 'failed';
      isReady = false;
    }

    // Test Redis readiness
    try {
      const redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD,
        lazyConnect: true,
        maxRetriesPerRequest: 1
      });
      
      await redis.ping();
      readiness.checks.redis = {
        status: 'ready',
        connected: true
      };
      redis.disconnect();
    } catch (error) {
      readiness.checks.redis = {
        status: 'unavailable',
        connected: false
      };
      // Redis unavailability doesn't make service not ready
    }

    // Test queue system readiness
    try {
      const queueStats = await taskQueueService.getQueueStats();
      readiness.checks.queues = {
        status: 'ready',
        initialized: true,
        stats: queueStats
      };
    } catch (error) {
      readiness.checks.queues = {
        status: 'unavailable',
        initialized: false
      };
      // Queue unavailability doesn't make service not ready
    }

    if (!isReady) {
      reply.code(503);
      readiness.status = 'not_ready';
    }

    return readiness;
  });

  // Liveness check - for Kubernetes liveness probes
  fastify.get('/health/live', async () => {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      pid: process.pid
    };
  });
};
