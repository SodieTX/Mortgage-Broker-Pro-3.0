# Email Setup Guide

This guide will help you set up email sending with Gmail, Microsoft (Outlook/Office 365), or other providers.

## Quick Start

### Gmail Setup

1. **Enable 2-Factor Authentication**
   - Go to your [Google Account Security](https://myaccount.google.com/security)
   - Enable 2-Step Verification

2. **Generate App Password**
   - Visit [App Passwords](https://myaccount.google.com/apppasswords)
   - Select "Mail" and your device
   - Copy the generated 16-character password

3. **Configure .env**
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-16-char-app-password
   ```

### Microsoft/Outlook Setup

1. **Enable 2-Factor Authentication**
   - Go to [Microsoft Security](https://account.microsoft.com/security)
   - Set up two-step verification

2. **Create App Password**
   - In Security settings, find "Advanced security options"
   - Under "App passwords", create a new password
   - Copy the generated password

3. **Configure .env**
   
   For personal Outlook accounts:
   ```env
   SMTP_HOST=smtp-mail.outlook.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-email@outlook.com
   SMTP_PASS=your-app-password
   ```
   
   For Office 365/Business accounts:
   ```env
   SMTP_HOST=smtp.office365.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-email@company.com
   SMTP_PASS=your-app-password
   ```

## Rate Limits

Our system automatically respects provider limits:

### Gmail
- **Per minute**: 20 emails
- **Per hour**: 500 emails
- **Per day**: 2,000 emails
- **Concurrent**: 10 connections

### Microsoft/Outlook
- **Per minute**: 30 emails
- **Per hour**: 3,600 emails
- **Per day**: 10,000 emails
- **Concurrent**: 20 connections

## Features

### Automatic Features
- ✅ Rate limiting to prevent blocking
- ✅ Automatic retry on failure
- ✅ Health monitoring
- ✅ Multiple provider fallback
- ✅ Email tracking (opens/clicks)
- ✅ Bounce handling
- ✅ Unsubscribe management

### Supported Email Types
- Welcome emails
- Password reset
- Report delivery (with PDF attachments)
- Scenario updates
- Marketing campaigns
- Transactional notifications

## Advanced Configuration

### Multiple Providers (Optional)

You can configure multiple providers for automatic fallback:

```env
# Primary (Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_USER=primary@gmail.com
SMTP_PASS=app-password-1

# Backup (SendGrid)
SENDGRID_API_KEY=SG.xxxxx

# Additional Backup (Mailgun)
MAILGUN_API_KEY=xxxxx
MAILGUN_DOMAIN=mg.yourdomain.com
```

### Custom Domain Setup

For professional emails from your domain:

1. **SPF Record**
   ```
   v=spf1 include:_spf.google.com include:spf.protection.outlook.com ~all
   ```

2. **DKIM** - Automatically handled by providers

3. **DMARC Record**
   ```
   v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com
   ```

## Troubleshooting

### Gmail Issues

**"Less secure app access"**
- Not needed with app passwords
- Make sure 2FA is enabled

**"Authentication failed"**
- Verify app password is correct (no spaces)
- Check if account has been locked

### Microsoft Issues

**"Authentication unsuccessful"**
- Ensure app password is created after enabling 2FA
- Try both smtp-mail.outlook.com and smtp.office365.com

**"550 5.7.60 SMTP client does not have permissions"**
- Enable SMTP AUTH for the mailbox
- Check organization policies

### General Issues

**Rate limit errors**
- System automatically handles these
- Check metrics at `/api/email/metrics`

**Emails going to spam**
- Set up SPF/DKIM/DMARC records
- Avoid spam trigger words
- Include unsubscribe links

## Monitoring

View email metrics and health:
```
GET http://localhost:3001/api/email/metrics
```

View provider status:
```json
{
  "providers": {
    "primary-smtp": {
      "enabled": true,
      "healthScore": 100,
      "lastUsed": "2024-01-20T10:30:00Z"
    }
  }
}
```

## Security Best Practices

1. **Never commit passwords** - Use environment variables
2. **Use app passwords** - Not your main account password
3. **Enable 2FA** - Required for app passwords
4. **Monitor usage** - Check for unusual activity
5. **Rotate passwords** - Update app passwords periodically

## Support

If you need help:
1. Check the logs: `npm run logs`
2. View metrics: `/api/email/metrics`
3. Test email: Use the test endpoint
4. Check provider status in the dashboard

Remember: The system handles most issues automatically with retries and fallbacks!
