/**
 * EMC² Core Service - Main Entry Point
 * 
 * Keep it simple. Keep it maintainable.
 */

import dotenv from 'dotenv';

// Load environment variables first
dotenv.config();

// Initialize telemetry before anything else
import { initializeTelemetry } from './telemetry';
const telemetrySDK = initializeTelemetry();

import { createServer } from './server';
import { logger } from './utils/logger';

// Environment already loaded above

async function start() {
  try {
    // Create and start the server
    const server = await createServer();
    
    const port = Number(process.env.PORT) || 3001;
    const host = process.env.HOST || '0.0.0.0';
    
    await server.listen({ port, host });
    
    logger.info(`EMC² Core Service started on http://${host}:${port}`);
    logger.info('Health check available at: /health');
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    if (error instanceof Error) {
      logger.error('Error details:', {
        message: error.message,
        stack: error.stack
      });
    }
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  
  // Shutdown telemetry
  await telemetrySDK.shutdown();
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  
  // Shutdown telemetry
  await telemetrySDK.shutdown();
  
  process.exit(0);
});

// Start the service
start();
