/**
 * Hermes Service - Main Entry Point
 * 
 * Data transformation made simple
 */

import dotenv from 'dotenv';
import { createServer } from './server';
import { logger } from './utils/logger';
import { initializeTelemetry } from './telemetry';
// Only import Fastify types, not the default export
import type { FastifyRequest, FastifyReply, FastifyError } from 'fastify';

// Load environment variables
dotenv.config();

// Environment variable validation (simple manual check)
const requiredEnv = ['PORT', 'HOST', 'NODE_ENV'];
for (const v of requiredEnv) {
  if (!process.env[v]) {
    console.error(`Missing required environment variable: ${v}`);
    process.exit(1);
  }
}

// Initialize telemetry before anything else
initializeTelemetry();

// Health check endpoint for Fastify
async function start() {
  try {
    // Create and start the server
    const server = await createServer();
    server.setErrorHandler((error: FastifyError, _request: FastifyRequest, reply: FastifyReply) => {
      console.error('Global error handler:', error);
      reply.status(500).send({ error: 'Internal Server Error' });
    });
    
    // Add health check route to server
    server.get('/health', async (_request: FastifyRequest, _reply: FastifyReply) => {
      return { status: 'ok', service: 'hermes', uptime: process.uptime() };
    });
    server.get('/v1/health', async (_request: FastifyRequest, _reply: FastifyReply) => {
      return { status: 'ok', service: 'hermes', uptime: process.uptime() };
    });
    
    const port = Number(process.env.PORT) || 3002;
    const host = process.env.HOST || '0.0.0.0';
    
    await server.listen({ port, host });
    
    logger.info(`Hermes Service started on http://${host}:${port}`);
    logger.info('Health check available at: /v1/health');
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Start the service
start();
