/**
 * Enhanced Health Check Routes V2
 * 
 * World-class health monitoring with observability integration
 */

import { FastifyPluginAsync } from 'fastify';
import { getHealthService } from '../services/healthService';
import { recordHttpMetrics, httpRequestsActive } from '../telemetry/metrics';
import { correlationIdPlugin } from '../middleware/correlationId';

export const healthV2Routes: FastifyPluginAsync = async (fastify) => {
  // Apply correlation ID to health checks
  fastify.addHook('onRequest', correlationIdPlugin());
  
  // Middleware to track active requests
  fastify.addHook('onRequest', async () => {
    httpRequestsActive.add(1);
  });
  
  fastify.addHook('onResponse', async () => {
    httpRequestsActive.add(-1);
  });

  /**
   * Basic health check - fast response for load balancers
   * GET /health/v2
   */
  fastify.get('/health/v2', {
    schema: {
      description: 'Basic health check endpoint',
      tags: ['health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['ok'] },
            timestamp: { type: 'string' },
            uptime: { type: 'number' },
            environment: { type: 'string' },
            version: { type: 'string' }
          }
        }
      }
    }
  }, async (_request, _reply) => {
    const start = Date.now();
    
    try {
      const uptime = Math.floor(process.uptime());
      
      const response = {
        status: 'ok' as const,
        timestamp: new Date().toISOString(),
        uptime,
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '0.0.1'
      };
      
      recordHttpMetrics('GET', '/health/v2', 200, Date.now() - start);
      return response;
    } catch (error) {
      recordHttpMetrics('GET', '/health/v2', 500, Date.now() - start);
      throw error;
    }
  });

  /**
   * Comprehensive health check with all dependencies
   * GET /health/v2/full
   */
  fastify.get('/health/v2/full', {
    schema: {
      description: 'Comprehensive health check with dependency status',
      tags: ['health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
            timestamp: { type: 'string' },
            uptime: { type: 'number' },
            version: { type: 'string' },
            environment: { type: 'string' },
            checks: {
              type: 'object',
              additionalProperties: {
                type: 'object',
                properties: {
                  status: { type: 'string', enum: ['up', 'down', 'degraded'] },
                  latency: { type: 'number' },
                  message: { type: 'string' },
                  metadata: { type: 'object' }
                }
              }
            }
          }
        },
        503: {
          $ref: '#/components/schemas/HealthCheckResult'
        }
      }
    }
  }, async (request, reply) => {
    const start = Date.now();
    
    try {
      const healthService = getHealthService();
      const result = await healthService.checkHealth();
      
      // Add correlation ID to response
      const response = {
        ...result,
        correlationId: request.correlationId
      };
      
      const statusCode = result.status === 'healthy' ? 200 : 
                        result.status === 'degraded' ? 200 : 503;
      
      recordHttpMetrics('GET', '/health/v2/full', statusCode, Date.now() - start);
      
      return reply.code(statusCode).send(response);
    } catch (error) {
      recordHttpMetrics('GET', '/health/v2/full', 500, Date.now() - start);
      request.log.error('Health check failed:', error);
      
      return reply.code(500).send({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
        correlationId: request.correlationId
      });
    }
  });

  /**
   * Kubernetes liveness probe - is the service alive?
   * GET /health/v2/live
   */
  fastify.get('/health/v2/live', {
    schema: {
      description: 'Kubernetes liveness probe',
      tags: ['health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['ok'] }
          }
        },
        503: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['error'] }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const healthService = getHealthService();
      const result = await healthService.getLiveness();
      
      if (result.status === 'ok') {
        return { status: 'ok' };
      } else {
        return reply.code(503).send({ status: 'error' });
      }
    } catch (error) {
      request.log.error('Liveness check failed:', error);
      return reply.code(503).send({ status: 'error' });
    }
  });

  /**
   * Kubernetes readiness probe - is the service ready for traffic?
   * GET /health/v2/ready
   */
  fastify.get('/health/v2/ready', {
    schema: {
      description: 'Kubernetes readiness probe',
      tags: ['health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['ready'] },
            checks: {
              type: 'object',
              additionalProperties: { type: 'boolean' }
            }
          }
        },
        503: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['not_ready'] },
            checks: {
              type: 'object',
              additionalProperties: { type: 'boolean' }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const healthService = getHealthService();
      const result = await healthService.getReadiness();
      
      const statusCode = result.status === 'ready' ? 200 : 503;
      return reply.code(statusCode).send(result);
    } catch (error) {
      request.log.error('Readiness check failed:', error);
      return reply.code(503).send({
        status: 'not_ready',
        error: 'Readiness check failed'
      });
    }
  });

  /**
   * Custom health check endpoint for specific component
   * GET /health/v2/check/:component
   */
  fastify.get<{
    Params: { component: string }
  }>('/health/v2/check/:component', {
    schema: {
      description: 'Check health of specific component',
      tags: ['health'],
      params: {
        type: 'object',
        properties: {
          component: { type: 'string' }
        },
        required: ['component']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            component: { type: 'string' },
            status: { type: 'string', enum: ['up', 'down', 'degraded'] },
            latency: { type: 'number' },
            message: { type: 'string' },
            metadata: { type: 'object' }
          }
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { component } = request.params;
    const start = Date.now();
    
    try {
      const healthService = getHealthService();
      const fullHealth = await healthService.checkHealth();
      
      if (component in fullHealth.checks) {
        const componentHealth = fullHealth.checks[component];
        
        recordHttpMetrics('GET', `/health/v2/check/${component}`, 200, Date.now() - start);
        
        return {
          component,
          ...componentHealth
        };
      } else {
        recordHttpMetrics('GET', `/health/v2/check/${component}`, 404, Date.now() - start);
        
        return reply.code(404).send({
          error: `Component '${component}' not found`
        });
      }
    } catch (error) {
      recordHttpMetrics('GET', `/health/v2/check/${component}`, 500, Date.now() - start);
      request.log.error(`Component health check failed for ${component}:`, error);
      throw error;
    }
  });
};
