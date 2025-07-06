/**
 * Hermes Service - Main Entry Point
 * 
 * Data transformation made simple
 */

import dotenv from 'dotenv';
import { createServer } from './server';
import { logger } from './utils/logger';

// Load environment variables
dotenv.config();

async function start() {
  try {
    // Create and start the server
    const server = await createServer();
    
    const port = Number(process.env.PORT) || 3002;
    const host = process.env.HOST || '0.0.0.0';
    
    await server.listen({ port, host });
    
    logger.info(`Hermes Service started on http://${host}:${port}`);
    logger.info('Health check available at: /health');
    
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
