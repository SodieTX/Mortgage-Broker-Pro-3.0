# Email Service - Fixed Architecture

## Overview

The email service has been refactored to resolve TypeScript compilation issues and hanging problems caused by circular dependencies and synchronous initialization during module loading.

## What Was Fixed

### 1. Circular Dependencies
- **Problem**: Services were importing each other in a circular pattern:
  - `emailService` → `emailProviderService` → `emailMonitoringService` → `emailQueueService` → `emailService`
- **Solution**: Created a service initializer that loads services in the correct dependency order using dynamic imports

### 2. Synchronous Initialization
- **Problem**: Services were initializing immediately in their constructors, blocking the event loop
- **Solution**: Deferred initialization until services are actually used

### 3. Service Wrapper
- **Problem**: Direct imports of services could still cause initialization issues
- **Solution**: Created a safe wrapper (`email`) that ensures proper initialization before use

## How to Use

### Import the Safe Wrapper

```typescript
// ❌ DON'T DO THIS - Direct import can cause issues
import { emailService } from './services/emailService';

// ✅ DO THIS - Use the safe wrapper
import { email } from './services/email';
```

### Send Emails

```typescript
// Simple email
await email.sendEmail({
  to: 'user@example.com',
  subject: 'Welcome!',
  html: '<p>Welcome to our service!</p>',
  text: 'Welcome to our service!'
});

// With template
await email.sendEmail({
  to: 'user@example.com',
  subject: 'Your Report',
  template: 'report',
  templateData: {
    name: 'John Doe',
    reportUrl: 'https://example.com/report/123'
  }
});

// With retry
await email.sendEmailWithRetry({
  to: 'user@example.com',
  subject: 'Important Update',
  html: '<p>This is important!</p>'
}, 3); // 3 retries

// Bulk emails
await email.sendBulkEmails({
  recipients: [
    { email: 'user1@example.com', data: { name: 'User 1' } },
    { email: 'user2@example.com', data: { name: 'User 2' } }
  ],
  subject: 'Newsletter',
  template: 'newsletter',
  batchSize: 50
});
```

### Common Email Types

```typescript
// Welcome email
await email.sendWelcomeEmail({
  email: 'newuser@example.com',
  firstName: 'John',
  lastName: 'Doe'
});

// Password reset
await email.sendPasswordResetEmail(
  { email: 'user@example.com', firstName: 'John' },
  'reset-token-here'
);

// Report email with attachment
await email.sendReportEmail(
  { email: 'user@example.com', firstName: 'John' },
  { title: 'Monthly Report', description: 'Your monthly summary' },
  pdfBuffer
);

// Scenario update
await email.sendScenarioUpdateEmail(
  { email: 'user@example.com', firstName: 'John' },
  { title: 'Mortgage Scenario', status: 'Approved' }
);
```

## Testing

To test if the email service initializes properly:

```bash
# Run the initialization test
npx ts-node src/test-email-init.ts
```

This will:
1. Attempt to initialize all email services
2. Try to send a test email
3. Report success or failure with timing information
4. Exit with appropriate status code

## Environment Variables

Make sure these are configured:

```env
# SMTP Configuration
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@example.com
SMTP_PASS=your-password

# Optional: Email Providers
SENDGRID_API_KEY=your-sendgrid-key
MAILGUN_API_KEY=your-mailgun-key
MAILGUN_DOMAIN=mg.yourdomain.com
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
AWS_REGION=us-east-1

# Application URLs
APP_URL=https://yourdomain.com
FRONTEND_URL=https://app.yourdomain.com
```

## Architecture

```
┌─────────────────────┐
│   Application Code  │
└──────────┬──────────┘
           │ imports
           ▼
┌─────────────────────┐
│   email (wrapper)   │ ← Safe entry point
└──────────┬──────────┘
           │ ensures initialization
           ▼
┌─────────────────────┐
│ ServiceInitializer  │ ← Manages initialization order
└──────────┬──────────┘
           │ loads services in order
           ▼
┌─────────────────────────────────────┐
│ 1. emailRateLimitService            │
│ 2. emailPreferencesService          │
│ 3. emailTrackingService             │
│ 4. emailProviderService             │
│ 5. emailService                     │
│ 6. emailQueueService                │
│ 7. emailMonitoringService (started) │
└─────────────────────────────────────┘
```

## Troubleshooting

### Service Still Hanging?

1. Check for any direct imports of `emailService` in your code
2. Make sure environment variables are set correctly
3. Check Redis connection if using queues
4. Run the test script to isolate the issue

### TypeScript Errors?

1. Run `npx tsc --noEmit` to check for compilation errors
2. Make sure all services are using the wrapper pattern
3. Check for any circular imports in your own code

### Email Not Sending?

1. Check SMTP credentials and connection
2. Verify email templates exist in the configured path
3. Check logs for specific error messages
4. Try the test endpoint: `POST /api/email/test`
