/**
 * Security Configuration
 * 
 * Centralized security settings and policies
 */

export const securityConfig = {
  // CORS settings
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID', 'X-API-Key'],
    exposedHeaders: ['X-Correlation-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    maxAge: 86400 // 24 hours
  },

  // Rate limiting
  rateLimit: {
    global: {
      max: parseInt(process.env.RATE_LIMIT_GLOBAL || '100'),
      timeWindow: '1 minute'
    },
    auth: {
      login: {
        max: parseInt(process.env.RATE_LIMIT_LOGIN || '5'),
        timeWindow: '15 minutes'
      },
      register: {
        max: parseInt(process.env.RATE_LIMIT_REGISTER || '3'),
        timeWindow: '1 hour'
      },
      passwordReset: {
        max: parseInt(process.env.RATE_LIMIT_PASSWORD_RESET || '3'),
        timeWindow: '1 hour'
      }
    },
    api: {
      standard: {
        max: parseInt(process.env.RATE_LIMIT_API || '1000'),
        timeWindow: '1 hour'
      },
      premium: {
        max: parseInt(process.env.RATE_LIMIT_API_PREMIUM || '5000'),
        timeWindow: '1 hour'
      }
    }
  },

  // JWT settings
  jwt: {
    secret: process.env.JWT_SECRET || 'change-this-in-production',
    accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY || '30d',
    issuer: 'emc2-core',
    audience: 'mortgage-broker-pro'
  },

  // Password policy
  password: {
    minLength: parseInt(process.env.PASSWORD_MIN_LENGTH || '12'),
    requireUppercase: process.env.PASSWORD_REQUIRE_UPPERCASE !== 'false',
    requireLowercase: process.env.PASSWORD_REQUIRE_LOWERCASE !== 'false',
    requireNumbers: process.env.PASSWORD_REQUIRE_NUMBERS !== 'false',
    requireSpecialChars: process.env.PASSWORD_REQUIRE_SPECIAL !== 'false',
    preventCommonPasswords: true,
    preventReuse: parseInt(process.env.PASSWORD_PREVENT_REUSE || '5'),
    maxAge: parseInt(process.env.PASSWORD_MAX_AGE_DAYS || '90'),
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12')
  },

  // Session settings
  session: {
    maxConcurrent: parseInt(process.env.MAX_CONCURRENT_SESSIONS || '5'),
    timeout: parseInt(process.env.SESSION_TIMEOUT_MINUTES || '30') * 60 * 1000,
    extendOnActivity: true,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  },

  // 2FA settings
  twoFactor: {
    enabled: process.env.TWO_FACTOR_ENABLED !== 'false',
    issuer: 'Mortgage Broker Pro',
    window: 2, // Number of time steps to check
    backupCodes: 10,
    qrCodeSize: 200
  },

  // API key settings
  apiKey: {
    prefix: 'mbp_',
    length: 32,
    maxPerUser: parseInt(process.env.MAX_API_KEYS_PER_USER || '5'),
    defaultExpiry: 365 * 24 * 60 * 60 * 1000 // 1 year
  },

  // Security headers
  headers: {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // For Swagger UI
      "style-src 'self' 'unsafe-inline' https:",
      "img-src 'self' data: https:",
      "font-src 'self' https:",
      "connect-src 'self'",
      "media-src 'self'",
      "object-src 'none'",
      "frame-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests"
    ].join('; ')
  },

  // File upload restrictions
  fileUpload: {
    maxSize: parseInt(process.env.MAX_UPLOAD_SIZE || '10485760'), // 10MB
    allowedMimeTypes: [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv'
    ],
    scanForViruses: process.env.VIRUS_SCAN_ENABLED === 'true',
    quarantinePath: process.env.QUARANTINE_PATH || '/tmp/quarantine'
  },

  // Audit settings
  audit: {
    enabled: process.env.AUDIT_ENABLED !== 'false',
    logLevel: process.env.AUDIT_LOG_LEVEL || 'info',
    retentionDays: parseInt(process.env.AUDIT_RETENTION_DAYS || '90'),
    storageType: process.env.AUDIT_STORAGE || 'database',
    includeRequestBody: process.env.AUDIT_INCLUDE_BODY === 'true',
    includeResponseBody: process.env.AUDIT_INCLUDE_RESPONSE === 'true',
    sensitiveFields: [
      'password',
      'token',
      'secret',
      'apiKey',
      'creditCard',
      'ssn',
      'taxId',
      'bankAccount'
    ]
  },

  // Encryption settings
  encryption: {
    algorithm: 'aes-256-gcm',
    keyDerivation: 'pbkdf2',
    iterations: parseInt(process.env.ENCRYPTION_ITERATIONS || '100000'),
    saltLength: 32,
    tagLength: 16,
    ivLength: 16
  },

  // Trusted proxies
  trustedProxies: process.env.TRUSTED_PROXIES?.split(',') || ['127.0.0.1', '::1'],

  // Security monitoring
  monitoring: {
    suspiciousActivityThreshold: 10,
    blockDuration: 60 * 60 * 1000, // 1 hour
    alertEmail: process.env.SECURITY_ALERT_EMAIL,
    alertWebhook: process.env.SECURITY_ALERT_WEBHOOK
  }
};

// Security best practices checklist
export const securityChecklist = {
  deployment: [
    'Use HTTPS in production',
    'Set secure environment variables',
    'Enable firewall rules',
    'Configure intrusion detection',
    'Set up DDoS protection',
    'Enable database encryption',
    'Configure backup encryption',
    'Set up monitoring and alerting',
    'Enable audit logging',
    'Configure log rotation'
  ],
  
  application: [
    'Validate all input',
    'Sanitize all output',
    'Use parameterized queries',
    'Implement proper authentication',
    'Enforce authorization checks',
    'Enable rate limiting',
    'Use secure session management',
    'Implement CSRF protection',
    'Enable security headers',
    'Keep dependencies updated'
  ],
  
  data: [
    'Encrypt sensitive data at rest',
    'Encrypt data in transit',
    'Implement key rotation',
    'Use secure random generation',
    'Hash passwords properly',
    'Implement data retention policies',
    'Enable database auditing',
    'Backup data regularly',
    'Test restore procedures',
    'Implement data classification'
  ]
};
