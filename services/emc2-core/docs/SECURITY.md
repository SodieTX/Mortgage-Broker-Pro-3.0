# EMC2-Core Security Documentation

## Overview

EMC2-Core implements comprehensive security measures following OWASP best practices and industry standards to protect against common vulnerabilities and ensure data integrity.

## Security Features

### 1. Authentication & Authorization

- **JWT-based authentication** with refresh tokens
- **Role-Based Access Control (RBAC)** with fine-grained permissions
- **Two-Factor Authentication (2FA)** using TOTP
- **Session management** with concurrent session limits
- **Account lockout** after failed login attempts

### 2. Input Validation & Sanitization

- **Schema-based validation** using TypeBox for all API endpoints
- **Input sanitization** to prevent injection attacks
- **Protection against prototype pollution**
- **SQL injection prevention** through parameterized queries
- **NoSQL injection prevention** through input filtering

### 3. Rate Limiting

- **Global rate limiting** (100 requests/minute)
- **Auth endpoint protection** (5 login attempts/15 minutes)
- **API endpoint throttling** (1000 requests/hour standard, 5000 premium)
- **Distributed rate limiting** using Redis
- **Graceful degradation** when Redis is unavailable

### 4. Security Headers

- **Helmet.js** integration for comprehensive security headers
- **Content Security Policy (CSP)** to prevent XSS attacks
- **HSTS** for HTTPS enforcement
- **X-Frame-Options** to prevent clickjacking
- **X-Content-Type-Options** to prevent MIME sniffing

### 5. CORS Configuration

- **Configurable origins** via environment variables
- **Credential support** for authenticated requests
- **Method and header whitelisting**
- **Preflight request handling**

### 6. Password Security

- **Strong password policy enforcement**:
  - Minimum 12 characters
  - Upper and lowercase requirements
  - Number and special character requirements
  - Common password prevention
  - Sequential character detection
- **Argon2id hashing** with secure parameters
- **Password history** to prevent reuse
- **Password strength calculator**
- **Secure password generation**

### 7. API Key Management

- **Secure API key generation** with cryptographic randomness
- **Key rotation support**
- **Per-client rate limiting**
- **Key expiration and revocation**

### 8. Audit Logging

- **Comprehensive security event logging**
- **Authentication and authorization tracking**
- **Failed attempt monitoring**
- **Sensitive data access logging**
- **Security violation detection**
- **Compliance report generation**

### 9. Data Protection

- **Encryption at rest** for sensitive data
- **TLS/HTTPS enforcement** in production
- **Secure session storage**
- **PII data masking in logs**

### 10. File Upload Security

- **MIME type validation**
- **File size limits** (10MB default)
- **Virus scanning** (when enabled)
- **Quarantine for suspicious files**

## Security Configuration

### Environment Variables

```bash
# JWT Configuration
JWT_SECRET=your-secret-key-change-in-production
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=30d

# CORS Configuration
CORS_ORIGIN=https://app.example.com,https://www.example.com

# Rate Limiting
RATE_LIMIT_GLOBAL=100
RATE_LIMIT_LOGIN=5
RATE_LIMIT_API=1000

# Password Policy
PASSWORD_MIN_LENGTH=12
PASSWORD_REQUIRE_UPPERCASE=true
PASSWORD_REQUIRE_LOWERCASE=true
PASSWORD_REQUIRE_NUMBERS=true
PASSWORD_REQUIRE_SPECIAL=true

# Security Monitoring
SECURITY_ALERT_EMAIL=security@example.com
AUDIT_ENABLED=true
AUDIT_RETENTION_DAYS=90

# File Upload
MAX_UPLOAD_SIZE=10485760
VIRUS_SCAN_ENABLED=true
```

### API Key Usage

```bash
# Include API key in request headers
curl -H "X-API-Key: mbp_your-api-key" https://api.example.com/v1/scenarios
```

### Two-Factor Authentication Setup

```javascript
// 1. Enable 2FA for user
POST /api/v1/auth/2fa/setup

// 2. Verify with TOTP code
POST /api/v1/auth/2fa/verify
{
  "token": "123456"
}

// 3. Include 2FA code in login
POST /api/v1/auth/login
{
  "email": "user@example.com",
  "password": "secure-password",
  "twoFactorCode": "123456"
}
```

## Security Best Practices

### For Developers

1. **Never hardcode secrets** - Use environment variables
2. **Validate all input** - Use the provided schemas
3. **Use parameterized queries** - Never concatenate SQL
4. **Log security events** - Use the audit logging system
5. **Keep dependencies updated** - Run `npm audit` regularly

### For Deployment

1. **Use HTTPS** - Enable TLS with valid certificates
2. **Configure firewall** - Restrict unnecessary ports
3. **Enable monitoring** - Set up alerts for suspicious activity
4. **Regular backups** - Test restore procedures
5. **Update regularly** - Apply security patches promptly

### For Operations

1. **Review audit logs** - Check for anomalies daily
2. **Monitor rate limits** - Adjust based on usage patterns
3. **Rotate secrets** - Change keys and passwords regularly
4. **Test security** - Perform regular penetration testing
5. **Train users** - Educate about phishing and social engineering

## Incident Response

### Detection

- Monitor audit logs for suspicious patterns
- Set up alerts for multiple failed login attempts
- Track rate limit violations
- Monitor for injection attempts

### Response

1. **Identify** the type and scope of incident
2. **Contain** by blocking affected IPs/users
3. **Investigate** using audit logs
4. **Remediate** vulnerabilities
5. **Document** lessons learned

### Recovery

1. Reset affected credentials
2. Review and update security policies
3. Notify affected users if required
4. Implement additional controls

## Compliance

EMC2-Core security features support compliance with:

- **SOC 2** - Security, availability, and confidentiality
- **ISO 27001** - Information security management
- **GDPR** - Data protection and privacy
- **PCI DSS** - Payment card data security (if applicable)

## Security Checklist

### Pre-Deployment

- [ ] Change all default passwords
- [ ] Set strong JWT secret
- [ ] Configure CORS origins
- [ ] Enable HTTPS
- [ ] Set up firewall rules
- [ ] Configure rate limits
- [ ] Enable audit logging
- [ ] Set up monitoring alerts

### Post-Deployment

- [ ] Verify security headers
- [ ] Test rate limiting
- [ ] Confirm audit logging
- [ ] Validate CORS configuration
- [ ] Test authentication flow
- [ ] Verify authorization checks
- [ ] Run security scan
- [ ] Document security procedures

## Contact

For security concerns or vulnerability reports, please contact:
- Email: security@mortgagebrokerpro.com
- PGP Key: [Available on request]

Please do not disclose security vulnerabilities publicly until they have been addressed.
