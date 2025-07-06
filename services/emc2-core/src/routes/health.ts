/**
 * Health Check Routes
 * 
 * Essential for monitoring and operations
 */

import { FastifyInstance } from 'fastify';
import { getDatabase } from '../db/connection';

export async function healthRoutes(server: FastifyInstance) {
  // Simple health check
  server.get('/health', async () => {
    return { 
      status: 'healthy',
      timestamp: new Date().toISOString()
    };
  });
  
  // Detailed health check including database
  server.get('/health/detailed', async (_request, reply) => {
    const checks = {
      service: 'healthy',
      database: 'unknown',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };
    
    try {
      // Check database connection
      const db = await getDatabase();
      const result = await db.query('SELECT NOW() as current_time, version() as version');
      checks.database = 'healthy';
      
      return reply.code(200).send({
        status: 'healthy',
        checks,
        database: {
          currentTime: result.rows[0].current_time,
          version: result.rows[0].version
        }
      });
    } catch (error) {
      checks.database = 'unhealthy';
      
      return reply.code(503).send({
        status: 'unhealthy',
        checks,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
