/**
 * Authentication Service
 * 
 * Production-ready authentication with refresh tokens, sessions, 2FA, and audit logging
 */

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';
import { Redis } from 'ioredis';
import { 
  UserSession, 
  AuthAction,
  JWTPayload
} from '../types/auth';
import { logger } from '../utils/logger';
import { email as emailService } from './email';
import { 
  SecurityEventType,
  logSecurityEvent
} from '../utils/securityAudit';

export class AuthService {
  private db: Pool;
  private redis: Redis;
  private readonly REFRESH_TOKEN_EXPIRY_DAYS = 30;
  private readonly PASSWORD_RESET_EXPIRY_HOURS = 2;
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION_MINUTES = 30;
  
  constructor(db: Pool, redis: Redis) {
    this.db = db;
    this.redis = redis;
  }

  /**
   * Create a new session with refresh token
   */
  async createSession(
    userId: string, 
    userAgent?: string, 
    ipAddress?: string
  ): Promise<{ sessionId: string; refreshToken: string }> {
    const sessionId = uuidv4();
    const refreshToken = this.generateSecureToken();
    const hashedToken = await argon2.hash(refreshToken);
    
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      
      // Create session
      await client.query(`
        INSERT INTO auth.user_sessions 
        (id, user_id, user_agent, ip_address, expires_at, is_active)
        VALUES ($1, $2, $3, $4, $5, true)
      `, [
        sessionId,
        userId,
        userAgent,
        ipAddress,
        new Date(Date.now() + this.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
      ]);
      
      // Create refresh token
      await client.query(`
        INSERT INTO auth.refresh_tokens 
        (id, user_id, token, session_id, user_agent, ip_address, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        uuidv4(),
        userId,
        hashedToken,
        sessionId,
        userAgent,
        ipAddress,
        new Date(Date.now() + this.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
      ]);
      
      await client.query('COMMIT');
      
      // Log session creation
      await this.logAuthEvent(AuthAction.LOGIN, userId, { sessionId }, ipAddress, userAgent);
      
      // Audit successful login
      await logSecurityEvent({
        eventType: SecurityEventType.LOGIN_SUCCESS,
        userId,
        ip: ipAddress,
        userAgent,
        details: { sessionId }
      });
      
      return { sessionId, refreshToken };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Validate and refresh tokens
   */
  async refreshTokens(
    refreshToken: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<{ accessToken: JWTPayload; newRefreshToken: string } | null> {
    const client = await this.db.connect();
    try {
      // Find valid refresh token
      const result = await client.query(`
        SELECT rt.*, u.email, u.role 
        FROM auth.refresh_tokens rt
        JOIN auth.users u ON rt.user_id = u.id
        WHERE rt.revoked_at IS NULL 
        AND rt.expires_at > NOW()
        ORDER BY rt.created_at DESC
      `);
      
      // Verify token against all valid tokens
      for (const row of result.rows) {
        const isValid = await argon2.verify(row.token, refreshToken);
        if (isValid) {
          await client.query('BEGIN');
          
          // Revoke old token
          await client.query(`
            UPDATE auth.refresh_tokens 
            SET revoked_at = NOW() 
            WHERE id = $1
          `, [row.id]);
          
          // Create new refresh token
          const newRefreshToken = this.generateSecureToken();
          const hashedNewToken = await argon2.hash(newRefreshToken);
          
          await client.query(`
            INSERT INTO auth.refresh_tokens 
            (id, user_id, token, session_id, user_agent, ip_address, expires_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            uuidv4(),
            row.user_id,
            hashedNewToken,
            row.session_id,
            userAgent,
            ipAddress,
            new Date(Date.now() + this.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
          ]);
          
          // Update session activity
          await client.query(`
            UPDATE auth.user_sessions 
            SET last_activity_at = NOW() 
            WHERE id = $1
          `, [row.session_id]);
          
          await client.query('COMMIT');
          
          // Log refresh event
          await this.logAuthEvent(
            AuthAction.TOKEN_REFRESH, 
            row.user_id, 
            { sessionId: row.session_id }, 
            ipAddress, 
            userAgent
          );
          
          // Audit token refresh
          await logSecurityEvent({
            eventType: SecurityEventType.TOKEN_REFRESH,
            userId: row.user_id,
            ip: ipAddress,
            userAgent,
            details: { sessionId: row.session_id }
          });
          
          return {
            accessToken: {
              id: row.user_id,
              email: row.email,
              role: row.role,
              type: 'access',
              sessionId: row.session_id
            },
            newRefreshToken
          };
        }
      }
      
      return null;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Logout and revoke session
   */
  async logout(sessionId: string, userId: string): Promise<void> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      
      // Revoke all tokens for this session
      await client.query(`
        UPDATE auth.refresh_tokens 
        SET revoked_at = NOW() 
        WHERE session_id = $1
      `, [sessionId]);
      
      // Deactivate session
      await client.query(`
        UPDATE auth.user_sessions 
        SET is_active = false 
        WHERE id = $1
      `, [sessionId]);
      
      await client.query('COMMIT');
      
      // Add to blacklist in Redis with TTL
      const blacklistKey = `blacklist:${sessionId}`;
      await this.redis.setex(blacklistKey, 86400, '1'); // 24 hour TTL
      
      // Log logout
      await this.logAuthEvent(AuthAction.LOGOUT, userId, { sessionId });
      
      // Audit logout
      await logSecurityEvent({
        eventType: SecurityEventType.LOGOUT,
        userId,
        details: { sessionId }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check if session is blacklisted
   */
  async isSessionBlacklisted(sessionId: string): Promise<boolean> {
    const exists = await this.redis.exists(`blacklist:${sessionId}`);
    return exists === 1;
  }

  /**
   * Initiate password reset
   */
  async initiatePasswordReset(email: string, ipAddress?: string): Promise<void> {
    const client = await this.db.connect();
    try {
      // Get user
      const userResult = await client.query(
        'SELECT id, first_name FROM auth.users WHERE email = $1',
        [email]
      );
      
      if (userResult.rows.length === 0) {
        // Don't reveal if user exists
        return;
      }
      
      const user = userResult.rows[0];
      const resetToken = this.generateSecureToken();
      const hashedToken = await argon2.hash(resetToken);
      
      // Store reset token
      await client.query(`
        INSERT INTO auth.password_reset_tokens 
        (id, user_id, token, expires_at)
        VALUES ($1, $2, $3, $4)
      `, [
        uuidv4(),
        user.id,
        hashedToken,
        new Date(Date.now() + this.PASSWORD_RESET_EXPIRY_HOURS * 60 * 60 * 1000)
      ]);
      
      // Send reset email
      await emailService.sendPasswordResetEmail(
        { email, firstName: user.first_name },
        resetToken
      );
      
      // Log event
      await this.logAuthEvent(
        AuthAction.PASSWORD_RESET_REQUEST, 
        user.id, 
        { email }, 
        ipAddress
      );
      
      // Audit password reset request
      await logSecurityEvent({
        eventType: SecurityEventType.PASSWORD_RESET_REQUEST,
        userId: user.id,
        email,
        ip: ipAddress,
        details: { email }
      });
    } finally {
      client.release();
    }
  }

  /**
   * Complete password reset
   */
  async resetPassword(
    token: string, 
    newPassword: string, 
    ipAddress?: string
  ): Promise<boolean> {
    const client = await this.db.connect();
    try {
      // Find valid reset token
      const tokenResult = await client.query(`
        SELECT * FROM auth.password_reset_tokens 
        WHERE used_at IS NULL 
        AND expires_at > NOW()
      `);
      
      for (const row of tokenResult.rows) {
        const isValid = await argon2.verify(row.token, token);
        if (isValid) {
          await client.query('BEGIN');
          
          // Hash new password
          const hashedPassword = await argon2.hash(newPassword);
          
          // Update password
          await client.query(`
            UPDATE auth.users 
            SET password_hash = $1, updated_at = NOW() 
            WHERE id = $2
          `, [hashedPassword, row.user_id]);
          
          // Mark token as used
          await client.query(`
            UPDATE auth.password_reset_tokens 
            SET used_at = NOW() 
            WHERE id = $1
          `, [row.id]);
          
          // Revoke all existing sessions
          await client.query(`
            UPDATE auth.user_sessions 
            SET is_active = false 
            WHERE user_id = $1
          `, [row.user_id]);
          
          await client.query('COMMIT');
          
          // Log event
          await this.logAuthEvent(
            AuthAction.PASSWORD_RESET_COMPLETE, 
            row.user_id, 
            {}, 
            ipAddress
          );
          
          // Audit password reset completion
          await logSecurityEvent({
            eventType: SecurityEventType.PASSWORD_RESET_SUCCESS,
            userId: row.user_id,
            ip: ipAddress,
            details: { allSessionsRevoked: true }
          });
          
          return true;
        }
      }
      
      return false;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check and handle login attempts for rate limiting
   */
  async checkLoginAttempts(email: string): Promise<boolean> {
    const key = `login_attempts:${email}`;
    const attempts = await this.redis.incr(key);
    
    if (attempts === 1) {
      // Set expiry on first attempt
      await this.redis.expire(key, this.LOCKOUT_DURATION_MINUTES * 60);
    }
    
    if (attempts > this.MAX_LOGIN_ATTEMPTS) {
      // Get user for logging
      const userResult = await this.db.query(
        'SELECT id FROM auth.users WHERE email = $1',
        [email]
      );
      
      if (userResult.rows.length > 0) {
        await this.logAuthEvent(
          AuthAction.ACCOUNT_LOCKED,
          userResult.rows[0].id,
          { reason: 'Too many login attempts' }
        );
        
        // Audit account lockout
        await logSecurityEvent({
          eventType: SecurityEventType.ACCOUNT_LOCKED,
          userId: userResult.rows[0].id,
          email,
          severity: 'WARNING',
          details: { reason: 'Too many login attempts', attempts }
        });
      }
      
      return false;
    }
    
    return true;
  }

  /**
   * Reset login attempts on successful login
   */
  async resetLoginAttempts(email: string): Promise<void> {
    await this.redis.del(`login_attempts:${email}`);
  }

  /**
   * Setup 2FA for user
   */
  async setup2FA(userId: string): Promise<{ secret: string; qrCode: string; backupCodes: string[] }> {
    const client = await this.db.connect();
    try {
      // Generate secret
      const secret = speakeasy.generateSecret({
        name: `Mortgage Broker Pro (${userId})`,
        length: 32
      });
      
      // Generate backup codes
      const backupCodes = Array.from({ length: 10 }, () => 
        crypto.randomBytes(4).toString('hex').toUpperCase()
      );
      
      // Hash backup codes
      const hashedBackupCodes = await Promise.all(
        backupCodes.map(code => argon2.hash(code))
      );
      
      // Store in database
      await client.query(`
        INSERT INTO auth.two_factor_secrets (user_id, secret, backup_codes, enabled)
        VALUES ($1, $2, $3, false)
        ON CONFLICT (user_id) 
        DO UPDATE SET secret = $2, backup_codes = $3, updated_at = NOW()
      `, [userId, secret.base32, hashedBackupCodes]);
      
      // Generate QR code
      const qrCode = await qrcode.toDataURL(secret.otpauth_url!);
      
      return {
        secret: secret.base32,
        qrCode,
        backupCodes
      };
    } finally {
      client.release();
    }
  }

  /**
   * Verify 2FA token
   */
  async verify2FA(userId: string, token: string): Promise<boolean> {
    const result = await this.db.query(
      'SELECT secret, backup_codes FROM auth.two_factor_secrets WHERE user_id = $1 AND enabled = true',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return false;
    }
    
    const { secret, backup_codes } = result.rows[0];
    
    // Try TOTP token first
    const isValid = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2
    });
    
    if (isValid) {
      await this.logAuthEvent(AuthAction.TWO_FACTOR_VERIFIED, userId);
      return true;
    }
    
    // Try backup codes
    for (let i = 0; i < backup_codes.length; i++) {
      const isBackupValid = await argon2.verify(backup_codes[i], token);
      if (isBackupValid) {
        // Remove used backup code
        backup_codes.splice(i, 1);
        await this.db.query(
          'UPDATE auth.two_factor_secrets SET backup_codes = $1 WHERE user_id = $2',
          [backup_codes, userId]
        );
        
        await this.logAuthEvent(AuthAction.TWO_FACTOR_VERIFIED, userId, { method: 'backup_code' });
        return true;
      }
    }
    
    return false;
  }

  /**
   * Log authentication events
   */
  async logAuthEvent(
    action: AuthAction,
    userId?: string,
    metadata?: Record<string, any>,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      await this.db.query(`
        INSERT INTO auth.audit_logs 
        (id, user_id, action, metadata, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        uuidv4(),
        userId,
        action,
        JSON.stringify(metadata || {}),
        ipAddress,
        userAgent
      ]);
      
      logger.info(`Auth event: ${action}`, { userId, metadata, ipAddress });
    } catch (error) {
      logger.error('Failed to log auth event', { error, action, userId });
    }
  }

  /**
   * Get user's active sessions
   */
  async getUserSessions(userId: string): Promise<UserSession[]> {
    const result = await this.db.query(`
      SELECT * FROM auth.user_sessions 
      WHERE user_id = $1 AND is_active = true 
      ORDER BY last_activity_at DESC
    `, [userId]);
    
    return result.rows;
  }

  /**
   * Revoke specific session
   */
  async revokeSession(sessionId: string, userId: string): Promise<void> {
    await this.logout(sessionId, userId);
  }

  /**
   * Generate secure random token
   */
  private generateSecureToken(): string {
    return crypto.randomBytes(32).toString('base64url');
  }
}
