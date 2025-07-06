/**
 * Authentication Routes
 * 
 * Production-ready authentication with sessions, RBAC, 2FA, and rate limiting
 */

import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { UserService, CreateUserDTO, LoginDTO } from '../services/userService';
import { AuthService } from '../services/authService';
import { RBACService } from '../services/rbacService';
import { getDatabase } from '../db/connection';
import { Redis } from 'ioredis';
import { authRateLimits } from '../middleware/auth';
import { AuthAction } from '../types/auth';
import { logger } from '../utils/logger';
import * as argon2 from 'argon2';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { id: string; email: string; role: string; type: string; sessionId?: string };
    user: { id: string; email: string; role: string; sessionId?: string };
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: any;
    authorize: any;
    optionalAuth: any;
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
      password: { type: 'string' },
      twoFactorCode: { type: 'string' }
    }
  }
};

const refreshTokenSchema = {
  body: {
    type: 'object',
    required: ['refreshToken'],
    properties: {
      refreshToken: { type: 'string' }
    }
  }
};

const passwordResetRequestSchema = {
  body: {
    type: 'object',
    required: ['email'],
    properties: {
      email: { type: 'string', format: 'email' }
    }
  }
};

const passwordResetSchema = {
  body: {
    type: 'object',
    required: ['token', 'newPassword'],
    properties: {
      token: { type: 'string' },
      newPassword: { type: 'string', minLength: 8 }
    }
  }
};

const changePasswordSchema = {
  body: {
    type: 'object',
    required: ['currentPassword', 'newPassword'],
    properties: {
      currentPassword: { type: 'string' },
      newPassword: { type: 'string', minLength: 8 }
    }
  }
};

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  const db = await getDatabase();
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379
  });
  
  const userService = new UserService(db);
  const authService = new AuthService(db, redis);
  const rbacService = new RBACService(db);

  /**
   * POST /auth/register
   * Register a new user with rate limiting
   */
  fastify.post<{ Body: CreateUserDTO }>(
    '/auth/register',
    { 
      schema: registerSchema,
      config: {
        rateLimit: authRateLimits.register
      }
    },
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

        // Create new user with hashed password
        const hashedPassword = await argon2.hash(request.body.password);
        const user = await userService.createUser({
          ...request.body,
          password: hashedPassword
        });
        
        // Create session
        const { sessionId, refreshToken } = await authService.createSession(
          user.id,
          request.headers['user-agent'] as string,
          request.ip
        );
        
        // Generate access token
        const accessToken = fastify.jwt.sign({
          id: user.id,
          email: user.email,
          role: user.role,
          type: 'access',
          sessionId
        }, { expiresIn: '15m' });

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
            accessToken,
            refreshToken,
            expiresIn: 900 // 15 minutes
          }
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error({ error: message }, 'Failed to register user');
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
   * Login with email, password, and optional 2FA
   */
  fastify.post<{ Body: LoginDTO & { twoFactorCode?: string } }>(
    '/auth/login',
    { 
      schema: loginSchema,
      config: {
        rateLimit: authRateLimits.login
      }
    },
    async (request, reply) => {
      try {
        // Check login attempts
        const canAttempt = await authService.checkLoginAttempts(request.body.email);
        if (!canAttempt) {
          return reply.code(429).send({
            success: false,
            error: 'Too many login attempts. Please try again later.',
            code: 'ACCOUNT_LOCKED'
          });
        }

        // Verify credentials
        const user = await userService.verifyCredentials(
          request.body.email,
          request.body.password
        );

        if (!user) {
          await authService.logAuthEvent(
            AuthAction.FAILED_LOGIN,
            undefined,
            { email: request.body.email },
            request.ip,
            request.headers['user-agent'] as string
          );
          
          return reply.code(401).send({
            success: false,
            error: 'Invalid credentials'
          });
        }

        // Check 2FA if enabled
        const twoFactorResult = await db.query(
          'SELECT enabled FROM auth.two_factor_secrets WHERE user_id = $1',
          [user.id]
        );
        
        if (twoFactorResult.rows.length > 0 && twoFactorResult.rows[0].enabled) {
          if (!request.body.twoFactorCode) {
            return reply.code(200).send({
              success: false,
              requiresTwoFactor: true,
              message: 'Two-factor authentication code required'
            });
          }
          
          const isValidCode = await authService.verify2FA(user.id, request.body.twoFactorCode);
          if (!isValidCode) {
            return reply.code(401).send({
              success: false,
              error: 'Invalid two-factor code'
            });
          }
        }

        // Reset login attempts on success
        await authService.resetLoginAttempts(request.body.email);
        
        // Create session
        const { sessionId, refreshToken } = await authService.createSession(
          user.id,
          request.headers['user-agent'] as string,
          request.ip
        );
        
        // Generate access token
        const accessToken = fastify.jwt.sign({
          id: user.id,
          email: user.email,
          role: user.role,
          type: 'access',
          sessionId
        }, { expiresIn: '15m' });

        // Update last login
        await db.query(
          'UPDATE auth.users SET last_login_at = NOW() WHERE id = $1',
          [user.id]
        );

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
            accessToken,
            refreshToken,
            expiresIn: 900
          }
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error({ error: message }, 'Failed to login user');
        return reply.code(500).send({
          success: false,
          error: 'Failed to login',
          message
        });
      }
    }
  );

  /**
   * POST /auth/logout
   * Logout and invalidate session
   */
  fastify.post(
    '/auth/logout',
    { 
      onRequest: [fastify.authenticate]
    },
    async (request: FastifyRequest, reply) => {
      try {
        if (request.sessionId) {
          await authService.logout(request.sessionId, request.user.id);
        }
        
        return {
          success: true,
          message: 'Logged out successfully'
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error({ error: message }, 'Failed to logout user');
        return reply.code(500).send({
          success: false,
          error: 'Failed to logout'
        });
      }
    }
  );

  /**
   * POST /auth/refresh
   * Refresh access token using refresh token
   */
  fastify.post<{ Body: { refreshToken: string } }>(
    '/auth/refresh',
    { schema: refreshTokenSchema },
    async (request, reply) => {
      try {
        const result = await authService.refreshTokens(
          request.body.refreshToken,
          request.headers['user-agent'] as string,
          request.ip
        );
        
        if (!result) {
          return reply.code(401).send({
            success: false,
            error: 'Invalid refresh token'
          });
        }
        
        const accessToken = fastify.jwt.sign(
          result.accessToken,
          { expiresIn: '15m' }
        );
        
        return {
          success: true,
          data: {
            accessToken,
            refreshToken: result.newRefreshToken,
            expiresIn: 900
          }
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error({ error: message }, 'Failed to refresh token');
        return reply.code(500).send({
          success: false,
          error: 'Failed to refresh token'
        });
      }
    }
  );

  /**
   * GET /auth/profile
   * Get current user profile with permissions
   */
  fastify.get(
    '/auth/profile',
    { 
      onRequest: [fastify.authenticate]
    },
    async (request: FastifyRequest, reply) => {
      try {
        const user = await userService.getUserById(request.user.id);
        if (!user) {
          return reply.code(404).send({
            success: false,
            error: 'User not found'
          });
        }

        const permissions = await rbacService.getUserPermissions(request.user.id);
        const sessions = await authService.getUserSessions(request.user.id);

        return {
          success: true,
          data: {
            user: {
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              company: user.company,
              role: user.role,
              twoFactorEnabled: user.twoFactorEnabled || false,
              createdAt: user.createdAt,
              updatedAt: user.updatedAt,
              lastLoginAt: user.lastLoginAt
            },
            permissions,
            activeSessions: sessions.length
          }
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error({ error: message }, 'Failed to get user profile');
        return reply.code(500).send({
          success: false,
          error: 'Failed to get profile'
        });
      }
    }
  );

  /**
   * POST /auth/password/reset-request
   * Request password reset email
   */
  fastify.post<{ Body: { email: string } }>(
    '/auth/password/reset-request',
    { 
      schema: passwordResetRequestSchema,
      config: {
        rateLimit: authRateLimits.passwordReset
      }
    },
    async (request, _reply) => {
      try {
        await authService.initiatePasswordReset(
          request.body.email,
          request.ip
        );
        
        // Always return success to prevent email enumeration
        return {
          success: true,
          message: 'If the email exists, a password reset link has been sent'
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error({ error: message }, 'Failed to initiate password reset');
        // Still return success to prevent enumeration
        return {
          success: true,
          message: 'If the email exists, a password reset link has been sent'
        };
      }
    }
  );

  /**
   * POST /auth/password/reset
   * Complete password reset
   */
  fastify.post<{ Body: { token: string; newPassword: string } }>(
    '/auth/password/reset',
    { schema: passwordResetSchema },
    async (request, reply) => {
      try {
        const success = await authService.resetPassword(
          request.body.token,
          request.body.newPassword,
          request.ip
        );
        
        if (!success) {
          return reply.code(400).send({
            success: false,
            error: 'Invalid or expired reset token'
          });
        }
        
        return {
          success: true,
          message: 'Password reset successfully'
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error({ error: message }, 'Failed to reset password');
        return reply.code(500).send({
          success: false,
          error: 'Failed to reset password'
        });
      }
    }
  );

  /**
   * POST /auth/password/change
   * Change password for authenticated user
   */
  fastify.post<{ Body: { currentPassword: string; newPassword: string } }>(
    '/auth/password/change',
    { 
      schema: changePasswordSchema,
      onRequest: [fastify.authenticate]
    },
    async (request, reply) => {
      try {
        // Verify current password
        const user = await userService.verifyCredentials(
          request.user.email,
          request.body.currentPassword
        );
        
        if (!user) {
          return reply.code(401).send({
            success: false,
            error: 'Current password is incorrect'
          });
        }
        
        // Update password
        const hashedPassword = await argon2.hash(request.body.newPassword);
        await db.query(
          'UPDATE auth.users SET password_hash = $1, password_changed_at = NOW() WHERE id = $2',
          [hashedPassword, request.user.id]
        );
        
        // Log event
        await authService.logAuthEvent(
          AuthAction.PASSWORD_CHANGE,
          request.user.id,
          {},
          request.ip,
          request.headers['user-agent'] as string
        );
        
        return {
          success: true,
          message: 'Password changed successfully'
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error({ error: message }, 'Failed to change password');
        return reply.code(500).send({
          success: false,
          error: 'Failed to change password'
        });
      }
    }
  );

  /**
   * GET /auth/sessions
   * Get user's active sessions
   */
  fastify.get(
    '/auth/sessions',
    { 
      onRequest: [fastify.authenticate]
    },
    async (request: FastifyRequest, reply) => {
      try {
        const sessions = await authService.getUserSessions(request.user.id);
        
        return {
          success: true,
          data: sessions.map(session => ({
            id: session.id,
            createdAt: session.createdAt,
            lastActivityAt: session.lastActivityAt,
            userAgent: session.userAgent,
            ipAddress: session.ipAddress,
            isCurrent: session.id === request.sessionId
          }))
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error({ error: message }, 'Failed to get sessions');
        return reply.code(500).send({
          success: false,
          error: 'Failed to get sessions'
        });
      }
    }
  );

  /**
   * DELETE /auth/sessions/:sessionId
   * Revoke specific session
   */
  fastify.delete<{ Params: { sessionId: string } }>(
    '/auth/sessions/:sessionId',
    { 
      onRequest: [fastify.authenticate]
    },
    async (request, reply) => {
      try {
        await authService.revokeSession(request.params.sessionId, request.user.id);
        
        return {
          success: true,
          message: 'Session revoked successfully'
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error({ error: message }, 'Failed to revoke session');
        return reply.code(500).send({
          success: false,
          error: 'Failed to revoke session'
        });
      }
    }
  );

  /**
   * POST /auth/2fa/setup
   * Setup 2FA for user
   */
  fastify.post(
    '/auth/2fa/setup',
    { 
      onRequest: [fastify.authenticate]
    },
    async (request: FastifyRequest, reply) => {
      try {
        const result = await authService.setup2FA(request.user.id);
        
        return {
          success: true,
          data: result
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error({ error: message }, 'Failed to setup 2FA');
        return reply.code(500).send({
          success: false,
          error: 'Failed to setup 2FA'
        });
      }
    }
  );

  /**
   * POST /auth/2fa/enable
   * Enable 2FA after verification
   */
  fastify.post<{ Body: { code: string } }>(
    '/auth/2fa/enable',
    { 
      onRequest: [fastify.authenticate],
      schema: {
        body: {
          type: 'object',
          required: ['code'],
          properties: {
            code: { type: 'string', minLength: 6, maxLength: 6 }
          }
        }
      }
    },
    async (request, reply) => {
      try {
        const isValid = await authService.verify2FA(request.user.id, request.body.code);
        
        if (!isValid) {
          return reply.code(400).send({
            success: false,
            error: 'Invalid verification code'
          });
        }
        
        // Enable 2FA
        await db.query(
          'UPDATE auth.two_factor_secrets SET enabled = true WHERE user_id = $1',
          [request.user.id]
        );
        
        await authService.logAuthEvent(
          AuthAction.TWO_FACTOR_ENABLED,
          request.user.id,
          {},
          request.ip,
          request.headers['user-agent'] as string
        );
        
        return {
          success: true,
          message: 'Two-factor authentication enabled successfully'
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error({ error: message }, 'Failed to enable 2FA');
        return reply.code(500).send({
          success: false,
          error: 'Failed to enable 2FA'
        });
      }
    }
  );

  /**
   * POST /auth/2fa/disable
   * Disable 2FA
   */
  fastify.post<{ Body: { password: string } }>(
    '/auth/2fa/disable',
    { 
      onRequest: [fastify.authenticate],
      schema: {
        body: {
          type: 'object',
          required: ['password'],
          properties: {
            password: { type: 'string' }
          }
        }
      }
    },
    async (request, reply) => {
      try {
        // Verify password
        const user = await userService.verifyCredentials(
          request.user.email,
          request.body.password
        );
        
        if (!user) {
          return reply.code(401).send({
            success: false,
            error: 'Invalid password'
          });
        }
        
        // Disable 2FA
        await db.query(
          'UPDATE auth.two_factor_secrets SET enabled = false WHERE user_id = $1',
          [request.user.id]
        );
        
        await authService.logAuthEvent(
          AuthAction.TWO_FACTOR_DISABLED,
          request.user.id,
          {},
          request.ip,
          request.headers['user-agent'] as string
        );
        
        return {
          success: true,
          message: 'Two-factor authentication disabled successfully'
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error({ error: message }, 'Failed to disable 2FA');
        return reply.code(500).send({
          success: false,
          error: 'Failed to disable 2FA'
        });
      }
    }
  );
};
