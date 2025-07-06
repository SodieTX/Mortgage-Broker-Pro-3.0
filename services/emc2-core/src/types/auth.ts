/**
 * Authentication Types
 * 
 * Type definitions for authentication and authorization
 */

export interface JWTPayload {
  id: string;
  email: string;
  role: string;
  type: 'access' | 'refresh';
  sessionId?: string;
}

export interface RefreshToken {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  revokedAt?: Date;
  sessionId: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface UserSession {
  id: string;
  userId: string;
  createdAt: Date;
  lastActivityAt: Date;
  expiresAt: Date;
  userAgent?: string;
  ipAddress?: string;
  isActive: boolean;
}

export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
  description?: string;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: Permission[];
}

export interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  resource?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export enum AuthAction {
  LOGIN = 'auth.login',
  LOGOUT = 'auth.logout',
  REGISTER = 'auth.register',
  PASSWORD_RESET_REQUEST = 'auth.password_reset_request',
  PASSWORD_RESET_COMPLETE = 'auth.password_reset_complete',
  PASSWORD_CHANGE = 'auth.password_change',
  TOKEN_REFRESH = 'auth.token_refresh',
  SESSION_EXPIRED = 'auth.session_expired',
  ACCOUNT_LOCKED = 'auth.account_locked',
  ACCOUNT_UNLOCKED = 'auth.account_unlocked',
  TWO_FACTOR_ENABLED = 'auth.2fa_enabled',
  TWO_FACTOR_DISABLED = 'auth.2fa_disabled',
  TWO_FACTOR_VERIFIED = 'auth.2fa_verified',
  FAILED_LOGIN = 'auth.failed_login',
  PERMISSION_DENIED = 'auth.permission_denied'
}

export interface PasswordResetToken {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  usedAt?: Date;
}

export interface TwoFactorSecret {
  userId: string;
  secret: string;
  backupCodes: string[];
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}
