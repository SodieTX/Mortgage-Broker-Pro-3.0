import { FastifyInstance } from 'fastify';

export function registerMetricsEndpoint(server: FastifyInstance) {
  server.get('/metrics', async (_request, reply) => {
    // Example: return a static Prometheus metric
    reply.type('text/plain').send('# HELP hermes_up 1\n# TYPE hermes_up gauge\nhermes_up 1\n');
  });
}
