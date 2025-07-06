/**
 * Email Configuration
 * 
 * Centralized email settings and SMTP configuration
 */

export interface EmailConfig {
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
    // Additional SMTP options
    tls?: {
      rejectUnauthorized: boolean;
    };
  };
  defaults: {
    from: string;
    replyTo?: string;
  };
  templates: {
    path: string;
  };
  queue: {
    redis: {
      host: string;
      port: number;
      password?: string;
    };
    retryAttempts: number;
    retryDelay: number;
  };
}

export const emailConfig: EmailConfig = {
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || ''
    },
    tls: {
      // Allow self-signed certificates in development
      rejectUnauthorized: process.env.NODE_ENV === 'production'
    }
  },
  defaults: {
    from: process.env.EMAIL_FROM || '"Mortgage Broker Pro" <noreply@mortgagebrokerpro.com>',
    replyTo: process.env.EMAIL_REPLY_TO || 'support@mortgagebrokerpro.com'
  },
  templates: {
    path: 'src/templates/email'
  },
  queue: {
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD
    },
    retryAttempts: 3,
    retryDelay: 5000 // 5 seconds
  }
};

// Validate required configuration
export function validateEmailConfig(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!emailConfig.smtp.host) {
    errors.push('SMTP_HOST is required');
  }

  if (!emailConfig.smtp.auth.user || !emailConfig.smtp.auth.pass) {
    errors.push('SMTP authentication credentials are required');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
