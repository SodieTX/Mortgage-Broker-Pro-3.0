/**
 * Password Security Utilities
 * 
 * Enforces strong password policies and secure handling
 */

import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { createLogger } from './observableLogger';

const logger = createLogger('password-security');
const tracer = trace.getTracer('emc2-core');

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  preventCommonPasswords: boolean;
  preventReuse: number; // Number of previous passwords to check
  maxAge?: number; // Days before password expires
}

export const defaultPasswordPolicy: PasswordPolicy = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  preventCommonPasswords: true,
  preventReuse: 5,
  maxAge: 90
};

// Common passwords to reject
const COMMON_PASSWORDS = new Set([
  'password', 'password123', '12345678', '123456789', 'qwerty', 'abc123',
  'password1', 'password12', 'admin', 'letmein', 'welcome', 'monkey',
  '1234567890', 'qwerty123', 'abc123', 'Password1', 'password1234',
  'welcome123', 'admin123', 'root123', 'toor', 'pass', 'test', 'guest'
]);

/**
 * Validate password against policy
 */
export function validatePassword(
  password: string, 
  policy: PasswordPolicy = defaultPasswordPolicy
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Length check
  if (password.length < policy.minLength) {
    errors.push(`Password must be at least ${policy.minLength} characters long`);
  }
  
  // Uppercase check
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  // Lowercase check
  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  // Number check
  if (policy.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  // Special character check
  if (policy.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  // Common password check
  if (policy.preventCommonPasswords) {
    const lowerPassword = password.toLowerCase();
    if (COMMON_PASSWORDS.has(lowerPassword)) {
      errors.push('Password is too common. Please choose a more unique password');
    }
    
    // Check for variations of common passwords
    for (const common of COMMON_PASSWORDS) {
      if (lowerPassword.includes(common)) {
        errors.push('Password contains a common pattern. Please choose a more unique password');
        break;
      }
    }
  }
  
  // Additional checks
  if (hasRepeatingCharacters(password)) {
    errors.push('Password contains too many repeating characters');
  }
  
  if (hasSequentialCharacters(password)) {
    errors.push('Password contains sequential characters');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Check for repeating characters
 */
function hasRepeatingCharacters(password: string): boolean {
  return /(.)\1{2,}/.test(password);
}

/**
 * Check for sequential characters
 */
function hasSequentialCharacters(password: string): boolean {
  const sequences = [
    'abcdefghijklmnopqrstuvwxyz',
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    '0123456789',
    'qwertyuiop',
    'asdfghjkl',
    'zxcvbnm'
  ];
  
  const lowerPassword = password.toLowerCase();
  
  for (const seq of sequences) {
    for (let i = 0; i <= seq.length - 4; i++) {
      if (lowerPassword.includes(seq.substring(i, i + 4))) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Hash password with Argon2id
 */
export async function hashPassword(password: string): Promise<string> {
  return tracer.startActiveSpan('password.hash', async (span) => {
    try {
      const hash = await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 65536, // 64 MB
        timeCost: 3,
        parallelism: 4
      });
      
      span.setStatus({ code: SpanStatusCode.OK });
      return hash;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Verify password against hash
 */
export async function verifyPassword(
  password: string, 
  hash: string
): Promise<boolean> {
  return tracer.startActiveSpan('password.verify', async (span) => {
    try {
      const valid = await argon2.verify(hash, password);
      
      span.setStatus({ code: SpanStatusCode.OK });
      span.setAttribute('password.valid', valid);
      
      return valid;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      return false;
    } finally {
      span.end();
    }
  });
}

/**
 * Check if password was previously used
 */
export async function checkPasswordHistory(
  password: string,
  previousHashes: string[]
): Promise<boolean> {
  for (const hash of previousHashes) {
    try {
      if (await verifyPassword(password, hash)) {
        return true;
      }
    } catch (error) {
      logger.warn('Error checking password history', { error });
    }
  }
  
  return false;
}

/**
 * Generate secure random password
 */
export function generateSecurePassword(
  length: number = 16,
  options: {
    uppercase?: boolean;
    lowercase?: boolean;
    numbers?: boolean;
    symbols?: boolean;
  } = {}
): string {
  const {
    uppercase = true,
    lowercase = true,
    numbers = true,
    symbols = true
  } = options;
  
  let charset = '';
  if (uppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (lowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
  if (numbers) charset += '0123456789';
  if (symbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';
  
  if (!charset) {
    throw new Error('At least one character type must be enabled');
  }
  
  const password = Array.from({ length }, () => {
    const randomIndex = randomBytes(1)[0] % charset.length;
    return charset[randomIndex];
  }).join('');
  
  // Ensure password meets requirements
  const validation = validatePassword(password);
  if (!validation.valid) {
    // Recursively generate until we get a valid password
    return generateSecurePassword(length, options);
  }
  
  return password;
}

/**
 * Calculate password strength score
 */
export function calculatePasswordStrength(password: string): {
  score: number;
  strength: 'very-weak' | 'weak' | 'fair' | 'good' | 'strong' | 'very-strong';
  feedback: string[];
} {
  let score = 0;
  const feedback: string[] = [];
  
  // Length score
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;
  if (password.length >= 20) score += 1;
  
  // Character diversity
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 2;
  
  // Patterns that reduce score
  if (hasRepeatingCharacters(password)) {
    score -= 1;
    feedback.push('Avoid repeating characters');
  }
  
  if (hasSequentialCharacters(password)) {
    score -= 1;
    feedback.push('Avoid sequential characters');
  }
  
  // Common passwords
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    score = 0;
    feedback.push('This is a commonly used password');
  }
  
  // Entropy estimation
  const entropy = calculateEntropy(password);
  if (entropy < 30) {
    feedback.push('Password is too predictable');
  } else if (entropy < 50) {
    feedback.push('Consider adding more unique characters');
  }
  
  // Normalize score
  score = Math.max(0, Math.min(10, score));
  
  // Determine strength
  let strength: 'very-weak' | 'weak' | 'fair' | 'good' | 'strong' | 'very-strong';
  if (score <= 2) strength = 'very-weak';
  else if (score <= 4) strength = 'weak';
  else if (score <= 6) strength = 'fair';
  else if (score <= 7) strength = 'good';
  else if (score <= 9) strength = 'strong';
  else strength = 'very-strong';
  
  // Add positive feedback
  if (password.length >= 16) {
    feedback.push('Good password length');
  }
  if (score >= 8) {
    feedback.push('Strong character diversity');
  }
  
  return { score, strength, feedback };
}

/**
 * Calculate password entropy
 */
function calculateEntropy(password: string): number {
  const charset = new Set(password).size;
  return password.length * Math.log2(charset);
}

/**
 * Time-safe password comparison
 */
export function timeSafeCompare(a: string, b: string): boolean {
  const aHash = createHash('sha256').update(a).digest();
  const bHash = createHash('sha256').update(b).digest();
  
  if (aHash.length !== bHash.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < aHash.length; i++) {
    result |= aHash[i] ^ bHash[i];
  }
  
  return result === 0;
}

/**
 * Mask password for logging
 */
export function maskPassword(password: string): string {
  if (!password || password.length === 0) return '';
  if (password.length <= 4) return '*'.repeat(password.length);
  
  const firstChar = password[0];
  const lastChar = password[password.length - 1];
  const masked = '*'.repeat(password.length - 2);
  
  return `${firstChar}${masked}${lastChar}`;
}
