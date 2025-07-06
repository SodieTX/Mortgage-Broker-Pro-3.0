/**
 * Simple Authentication Middleware
 * 
 * API key based authentication for simplicity
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../utils/logger';

// In production, store these in environment variables or database
const API_KEYS = new Set([
  process.env.API_KEY || 'development-key-change-me',
  'test-key-for-development' // Remove in production
]);

export interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    apiKey: string;
    name?: string;
  };
}

/**
 * Simple API key authentication
 */
export async function authenticate(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  const apiKey = request.headers['x-api-key'] as string;
  
  if (!apiKey) {
    logger.warn('Missing API key in request');
    return reply.code(401).send({ 
      error: 'Authentication required',
      message: 'Please provide an API key in the x-api-key header'
    });
  }
  
  if (!API_KEYS.has(apiKey)) {
    logger.warn('Invalid API key attempted', { apiKey: apiKey.substring(0, 8) + '...' });
    return reply.code(401).send({ 
      error: 'Invalid API key',
      message: 'The provided API key is not valid'
    });
  }
  
  // Add user info to request for logging
  request.user = {
    apiKey: apiKey.substring(0, 8) + '...', // Don't log full key
    name: apiKey === 'test-key-for-development' ? 'Test User' : 'API User'
  };
  
  logger.info('Authenticated request', { user: request.user.name });
}

/**
 * Optional authentication - allows both authenticated and unauthenticated requests
 */
export async function optionalAuth(
  request: AuthenticatedRequest,
  _reply: FastifyReply
): Promise<void> {
  const apiKey = request.headers['x-api-key'] as string;
  
  if (apiKey && API_KEYS.has(apiKey)) {
    request.user = {
      apiKey: apiKey.substring(0, 8) + '...',
      name: apiKey === 'test-key-for-development' ? 'Test User' : 'API User'
    };
  }
}
