/**
 * Auth Service Tests
 * 
 * Comprehensive tests for production auth features
 */

import { AuthService } from './authService';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import * as argon2 from 'argon2';
import { AuthAction } from '../types/auth';

// Mock dependencies
jest.mock('pg');
jest.mock('ioredis');
jest.mock('./email', () => ({
  email: {
    sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
    sendWelcomeEmail: jest.fn().mockResolvedValue(true),
    sendEmail: jest.fn().mockResolvedValue(true)
  }
}));

describe('AuthService', () => {
  let authService: AuthService;
  let mockDb: jest.Mocked<Pool>;
  let mockRedis: jest.Mocked<Redis>;
  let mockClient: any;

  beforeEach(() => {
    // Setup mock database
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };
    mockDb = {
      connect: jest.fn().mockResolvedValue(mockClient),
      query: jest.fn()
    } as any;
    
    // Fix TypeScript issue with mockDb.query
    (mockDb.query as jest.Mock) = jest.fn();

    // Setup mock Redis
    mockRedis = {
      incr: jest.fn(),
      expire: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      setex: jest.fn()
    } as any;

    authService = new AuthService(mockDb, mockRedis);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createSession', () => {
    it('should create a new session with refresh token', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      const result = await authService.createSession('user-123', 'Mozilla/5.0', '192.168.1.1');

      expect(result).toHaveProperty('sessionId');
      expect(result).toHaveProperty('refreshToken');
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.query).toHaveBeenCalledTimes(4); // BEGIN, session insert, token insert, COMMIT (audit log uses db.query)
    });

    it('should rollback on error', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(new Error('DB Error'));

      await expect(authService.createSession('user-123')).rejects.toThrow('DB Error');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('refreshTokens', () => {
    it('should refresh tokens with valid refresh token', async () => {
      const mockToken = 'valid-refresh-token';
      const hashedToken = await argon2.hash(mockToken);
      
      mockClient.query
        .mockResolvedValueOnce({
          rows: [{
            id: 'token-123',
            user_id: 'user-123',
            token: hashedToken,
            session_id: 'session-123',
            email: 'test@example.com',
            role: 'broker'
          }]
        })
        .mockResolvedValue({ rows: [] });

      const result = await authService.refreshTokens(mockToken);

      expect(result).not.toBeNull();
      expect(result?.accessToken).toMatchObject({
        id: 'user-123',
        email: 'test@example.com',
        role: 'broker',
        type: 'access',
        sessionId: 'session-123'
      });
      expect(result?.newRefreshToken).toBeDefined();
    });

    it('should return null for invalid refresh token', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await authService.refreshTokens('invalid-token');
      expect(result).toBeNull();
    });
  });

  describe('logout', () => {
    it('should revoke session and add to blacklist', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      await authService.logout('session-123', 'user-123');

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE auth.refresh_tokens'),
        ['session-123']
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE auth.user_sessions'),
        ['session-123']
      );
      expect(mockRedis.setex).toHaveBeenCalledWith('blacklist:session-123', 86400, '1');
    });
  });

  describe('checkLoginAttempts', () => {
    it('should allow login when under limit', async () => {
      mockRedis.incr.mockResolvedValue(3);
      mockRedis.expire.mockResolvedValue(1);

      const result = await authService.checkLoginAttempts('test@example.com');
      expect(result).toBe(true);
      // Redis expire is called internally
    });

    it('should block login when over limit', async () => {
      mockRedis.incr.mockResolvedValue(6);
      (mockDb.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'user-123' }] });

      const result = await authService.checkLoginAttempts('test@example.com');
      expect(result).toBe(false);
    });
  });

  describe('initiatePasswordReset', () => {
    it('should send reset email for existing user', async () => {
      mockClient.query
        .mockResolvedValueOnce({
          rows: [{ id: 'user-123', first_name: 'John' }]
        })
        .mockResolvedValue({ rows: [] });

      await authService.initiatePasswordReset('test@example.com');

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO auth.password_reset_tokens'),
        expect.any(Array)
      );
    });

    it('should not throw for non-existent user', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      await expect(authService.initiatePasswordReset('nobody@example.com'))
        .resolves.not.toThrow();
    });
  });

  describe('verify2FA', () => {
    it('should verify valid TOTP code', async () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      (mockDb.query as jest.Mock).mockResolvedValue({
        rows: [{
          secret,
          backup_codes: []
        }]
      });

      // Mock speakeasy verification
      jest.spyOn(require('speakeasy').totp, 'verify').mockReturnValue(true);

      const result = await authService.verify2FA('user-123', '123456');
      expect(result).toBe(true);
    });

    it('should verify valid backup code', async () => {
      const backupCode = 'BACKUP123';
      const hashedBackup = await argon2.hash(backupCode);
      
      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{
            secret: 'secret',
            backup_codes: [hashedBackup, 'other-code']
          }]
        })
        .mockResolvedValue({ rows: [] });

      jest.spyOn(require('speakeasy').totp, 'verify').mockReturnValue(false);

      const result = await authService.verify2FA('user-123', backupCode);
      expect(result).toBe(true);
    });
  });

  describe('isSessionBlacklisted', () => {
    it('should return true for blacklisted session', async () => {
      mockRedis.exists.mockResolvedValue(1);
      
      const result = await authService.isSessionBlacklisted('session-123');
      expect(result).toBe(true);
    });

    it('should return false for non-blacklisted session', async () => {
      mockRedis.exists.mockResolvedValue(0);
      
      const result = await authService.isSessionBlacklisted('session-456');
      expect(result).toBe(false);
    });
  });

  describe('logAuthEvent', () => {
    it('should log auth events to database', async () => {
      (mockDb.query as jest.Mock).mockResolvedValue({ rows: [] });

      await authService.logAuthEvent(
        AuthAction.LOGIN,
        'user-123',
        { sessionId: 'session-123' },
        '192.168.1.1',
        'Mozilla/5.0'
      );

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO auth.audit_logs'),
        expect.arrayContaining([
          expect.any(String), // id
          'user-123',
          AuthAction.LOGIN,
          expect.stringContaining('session-123'),
          '192.168.1.1',
          'Mozilla/5.0'
        ])
      );
    });

    it('should not throw on logging failure', async () => {
      (mockDb.query as jest.Mock).mockRejectedValue(new Error('DB Error'));

      await expect(authService.logAuthEvent(AuthAction.LOGIN))
        .resolves.not.toThrow();
    });
  });
});
