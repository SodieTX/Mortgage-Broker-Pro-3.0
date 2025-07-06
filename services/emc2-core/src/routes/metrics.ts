/**
 * Metrics Endpoint
 * 
 * Exposes metrics in Prometheus format
 */

import { FastifyInstance } from 'fastify';
import { register } from 'prom-client';

export const metricsRoutes = async (fastify: FastifyInstance) => {
  /**
   * Metrics endpoint for Prometheus
   */
  fastify.get('/metrics', async (request, reply) => {
    try {
      // Get metrics from prom-client register
      const metrics = await register.metrics();
      
      reply
        .header('Content-Type', register.contentType)
        .send(metrics);
    } catch (error) {
      request.log.error('Failed to get metrics:', error);
      reply.code(500).send({ error: 'Failed to collect metrics' });
    }
  });
  
  /**
   * Custom business metrics endpoint
   */
  fastify.get('/metrics/business', async (request, reply) => {
    try {
      // This could return custom business metrics in JSON format
      const businessMetrics = {
        scenarios: {
          created_today: 0,
          calculated_today: 0,
          active_total: 0,
        },
        reports: {
          generated_today: 0,
          downloaded_today: 0,
        },
        users: {
          active_today: 0,
          new_today: 0,
          total: 0,
        },
      };
      
      reply.send(businessMetrics);
    } catch (error) {
      request.log.error('Failed to get business metrics:', error);
      reply.code(500).send({ error: 'Failed to collect business metrics' });
    }
  });
};
