/**
 * Authentication Routes
 * 
 * Secure authentication for mortgage brokers
 */

import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { UserService, CreateUserDTO, LoginDTO } from '../services/userService';
import { getDatabase } from '../db/connection';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { id: string; email: string; role: string };
    user: { id: string; email: string; role: string };
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: any;
  }
}

// Schema definitions
const registerSchema = {
  body: {
    type: 'object',
    required: ['email', 'password', 'firstName', 'lastName'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 8 },
      firstName: { type: 'string', minLength: 1 },
      lastName: { type: 'string', minLength: 1 },
      company: { type: 'string' },
      role: { type: 'string', enum: ['broker', 'admin', 'viewer'] }
    }
  }
};

const loginSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string' }
    }
  }
};

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  const db = await getDatabase();
  const userService = new UserService(db);

  /**
   * POST /auth/register
   * Register a new broker account
   */
  fastify.post<{ Body: CreateUserDTO }>(
    '/auth/register',
    { schema: registerSchema },
    async (request, reply) => {
      try {
        // Check if user already exists
        const existing = await userService.findByEmail(request.body.email);
        if (existing) {
          return reply.code(409).send({
            success: false,
            error: 'User already exists'
          });
        }

        // Create new user
        const user = await userService.createUser(request.body);
        
        // Generate token
        const token = fastify.jwt.sign({
          id: user.id,
          email: user.email,
          role: user.role
        });

        return {
          success: true,
          data: {
            user: {
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              company: user.company,
              role: user.role
            },
            token
          }
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        fastify.log.error({ error: message }, 'Failed to register user');
        return reply.code(500).send({
          success: false,
          error: 'Failed to register user',
          message
        });
      }
    }
  );

  /**
   * POST /auth/login
   * Login with email and password
   */
  fastify.post<{ Body: LoginDTO }>(
    '/auth/login',
    { schema: loginSchema },
    async (request, reply) => {
      try {
        const user = await userService.verifyCredentials(
          request.body.email,
          request.body.password
        );

        if (!user) {
          return reply.code(401).send({
            success: false,
            error: 'Invalid credentials'
          });
        }

        // Generate token
        const token = fastify.jwt.sign({
          id: user.id,
          email: user.email,
          role: user.role
        });

        return {
          success: true,
          data: {
            user: {
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              company: user.company,
              role: user.role
            },
            token
          }
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        fastify.log.error({ error: message }, 'Failed to login user');
        return reply.code(500).send({
          success: false,
          error: 'Failed to login',
          message
        });
      }
    }
  );

  /**
   * GET /auth/profile
   * Get current user profile (requires authentication)
   */
  fastify.get(
    '/auth/profile',
    { 
      onRequest: [fastify.authenticate]
    },
    async (request: FastifyRequest, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({
            success: false,
            error: 'Unauthorized'
          });
        }

        const user = await userService.getUserById(request.user.id);
        
        if (!user) {
          return reply.code(404).send({
            success: false,
            error: 'User not found'
          });
        }

        return {
          success: true,
          data: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            company: user.company,
            role: user.role,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
          }
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        fastify.log.error({ error: message }, 'Failed to get user profile');
        return reply.code(500).send({
          success: false,
          error: 'Failed to get profile',
          message
        });
      }
    }
  );

  /**
   * POST /auth/refresh
   * Refresh JWT token
   */
  fastify.post(
    '/auth/refresh',
    { 
      onRequest: [fastify.authenticate]
    },
    async (request: FastifyRequest, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({
            success: false,
            error: 'Unauthorized'
          });
        }

        // Generate new token
        const token = fastify.jwt.sign({
          id: request.user.id,
          email: request.user.email,
          role: request.user.role
        });

        return {
          success: true,
          data: { token }
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        fastify.log.error({ error: message }, 'Failed to refresh token');
        return reply.code(500).send({
          success: false,
          error: 'Failed to refresh token',
          message
        });
      }
    }
  );
};
