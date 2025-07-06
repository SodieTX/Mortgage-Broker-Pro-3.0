/**
 * Email Routes
 * 
 * API endpoints for email tracking and management
 */

import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { emailTrackingService } from '../services/emailTrackingService';
import { emailMonitoringService } from '../services/emailMonitoringService';
import { emailProviderService } from '../services/emailProviderService';
import { emailRateLimitService } from '../services/emailRateLimitService';
import { logger } from '../utils/logger';

const emailRoutes: FastifyPluginAsync = async (fastify) => {
  
  /**
   * Track email open
   */
  fastify.get('/api/email/track/open/:trackingId', async (
    request: FastifyRequest<{ Params: { trackingId: string } }>,
    reply: FastifyReply
  ) => {
    const { trackingId } = request.params;
    
    try {
      // Track the open
      emailTrackingService.trackOpen(trackingId);
      
      // Return 1x1 transparent pixel
      const pixel = Buffer.from(
        'R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==',
        'base64'
      );
      
      return reply
        .header('Content-Type', 'image/gif')
        .header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
        .header('Pragma', 'no-cache')
        .header('Expires', '0')
        .send(pixel);
    } catch (error) {
      logger.error('Failed to track email open:', error);
      // Still return pixel on error
      return reply.code(200).type('image/gif').send(Buffer.alloc(0));
    }
  });

  /**
   * Track link click and redirect
   */
  fastify.get('/api/email/track/click/:trackingId', async (
    request: FastifyRequest<{
      Params: { trackingId: string };
      Querystring: { url: string; type?: string };
    }>,
    reply: FastifyReply
  ) => {
    const { trackingId } = request.params;
    const { url, type = 'general' } = request.query;
    
    try {
      // Decode URL
      const targetUrl = decodeURIComponent(url);
      
      // Track the click
      emailTrackingService.trackClick(trackingId, targetUrl, type);
      
      // Redirect to target URL
      return reply.redirect(302, targetUrl);
    } catch (error) {
      logger.error('Failed to track link click:', error);
      // Redirect to home page on error
      return reply.redirect(302, process.env.APP_URL || '/');
    }
  });

  /**
   * Handle unsubscribe
   */
  fastify.get('/api/email/unsubscribe', async (
    request: FastifyRequest<{ Querystring: { email: string; token?: string } }>,
    reply: FastifyReply
  ) => {
    const { email, token } = request.query;
    
    try {
      // Verify token if provided
      if (token) {
        // In production, verify the unsubscribe token
      }
      
      // Track unsubscribe
      emailTrackingService.trackUnsubscribe(email);
      
      // In production, update user preferences in database
      
      return reply.send({
        success: true,
        message: 'You have been unsubscribed successfully'
      });
    } catch (error) {
      logger.error('Failed to process unsubscribe:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to process unsubscribe'
      });
    }
  });

  /**
   * Get email metrics (requires authentication)
   */
  fastify.get('/api/email/metrics', {
    onRequest: [fastify.authenticate],
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            dashboard: { type: 'object' },
            providers: { type: 'object' },
            rateLimits: { type: 'array' }
          }
        }
      }
    }
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Get dashboard data
      const dashboard = emailMonitoringService.getDashboardData();
      
      // Get provider status
      const providers = emailProviderService.getProviderStatus();
      
      // Get rate limit status for each provider
      const rateLimits = await Promise.all(
        providers.providers.map(async (provider) => ({
          provider: provider.name,
          status: await emailRateLimitService.getRateLimitStatus(provider.name)
        }))
      );
      
      return reply.send({
        dashboard,
        providers,
        rateLimits
      });
    } catch (error) {
      logger.error('Failed to get email metrics:', error);
      return reply.code(500).send({
        error: 'Failed to get email metrics'
      });
    }
  });

  /**
   * Get Prometheus metrics
   */
  fastify.get('/api/email/metrics/prometheus', async (
    _request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const metrics = await emailMonitoringService.getMetrics();
      return reply
        .header('Content-Type', 'text/plain; version=0.0.4')
        .send(metrics);
    } catch (error) {
      logger.error('Failed to get Prometheus metrics:', error);
      return reply.code(500).send('Failed to get metrics');
    }
  });

  /**
   * Get campaign metrics (requires authentication)
   */
  fastify.get('/api/email/campaigns/:campaignId/metrics', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        properties: {
          campaignId: { type: 'string' }
        },
        required: ['campaignId']
      }
    }
  }, async (
    request: FastifyRequest<{ Params: { campaignId: string } }>,
    reply: FastifyReply
  ) => {
    const { campaignId } = request.params;
    
    try {
      const metrics = emailTrackingService.getCampaignMetrics(campaignId);
      return reply.send(metrics);
    } catch (error) {
      logger.error('Failed to get campaign metrics:', error);
      return reply.code(500).send({
        error: 'Failed to get campaign metrics'
      });
    }
  });

  /**
   * Get recipient history (requires authentication)
   */
  fastify.get('/api/email/recipients/:email/history', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' }
        },
        required: ['email']
      }
    }
  }, async (
    request: FastifyRequest<{ Params: { email: string } }>,
    reply: FastifyReply
  ) => {
    const { email } = request.params;
    
    try {
      const history = emailTrackingService.getRecipientHistory(email);
      return reply.send({ history });
    } catch (error) {
      logger.error('Failed to get recipient history:', error);
      return reply.code(500).send({
        error: 'Failed to get recipient history'
      });
    }
  });

  /**
   * Webhook endpoint for email service providers
   */
  fastify.post('/api/email/webhook/:provider', async (
    request: FastifyRequest<{
      Params: { provider: string };
      Body: any;
    }>,
    reply: FastifyReply
  ) => {
    const { provider } = request.params;
    const event = request.body;
    
    try {
      // Handle different provider webhooks
      switch (provider) {
        case 'sendgrid':
          await handleSendGridWebhook(Array.isArray(event) ? event : [event]);
          break;
        case 'mailgun':
          await handleMailgunWebhook(event);
          break;
        case 'ses':
          await handleSESWebhook(event);
          break;
        default:
          logger.warn(`Unknown webhook provider: ${provider}`);
      }
      
      return reply.send({ received: true });
    } catch (error) {
      logger.error(`Failed to process ${provider} webhook:`, error);
      return reply.code(500).send({ error: 'Webhook processing failed' });
    }
  });
  
  /**
   * Test email endpoint (requires authentication)
   */
  fastify.post('/api/email/test', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        properties: {
          to: { type: 'string', format: 'email' },
          provider: { type: 'string' }
        },
        required: ['to']
      }
    }
  }, async (
    request: FastifyRequest<{ Body: { to: string; provider?: string } }>,
    reply: FastifyReply
  ) => {
    const { to, provider } = request.body;
    
    try {
      // Import email service wrapper
      const { email } = await import('../services/email');
      
      // Send test email
      const result = await email.sendEmail({
        to,
        subject: 'Test Email from Mortgage Broker Pro',
        html: `
          <h2>Test Email Successful! 🎉</h2>
          <p>This is a test email from your Mortgage Broker Pro email system.</p>
          <p><strong>Configuration Details:</strong></p>
          <ul>
            <li>Sent to: ${to}</li>
            <li>Sent at: ${new Date().toLocaleString()}</li>
            <li>Provider: ${provider || 'Auto-selected'}</li>
          </ul>
          <p>Your email system is working correctly!</p>
          <hr>
          <p style="color: #666; font-size: 12px;">
            This is a test email. If you're seeing this, your email configuration is correct.
          </p>
        `,
        text: `Test Email from Mortgage Broker Pro\n\nThis test email confirms your email system is working correctly.\n\nSent to: ${to}\nSent at: ${new Date().toLocaleString()}\nProvider: ${provider || 'Auto-selected'}`
      });
      
      // Get provider status
      const providerStatus = emailProviderService.getProviderStatus();
      
      return reply.send({
        success: result,
        message: result ? 'Test email sent successfully!' : 'Failed to send test email',
        provider: providerStatus.activeProvider,
        availableProviders: providerStatus.providers.filter(p => p.enabled).map(p => p.name)
      });
    } catch (error) {
      logger.error('Failed to send test email:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to send test email',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
};

/**
 * Handle SendGrid webhook events
 */
async function handleSendGridWebhook(events: any[]) {
  for (const event of events) {
    const emailId = event.email_id || event['X-Email-Id'];
    
    switch (event.event) {
      case 'bounce':
        if (emailId) {
          emailTrackingService.trackBounce(
            emailId,
            event.type === 'hard' ? 'hard' : 'soft'
          );
        }
        break;
      case 'open':
        // Already tracked via pixel
        break;
      case 'click':
        // Already tracked via redirect
        break;
      case 'spamreport':
        if (emailId) {
          emailTrackingService.trackComplaint(emailId);
        }
        break;
    }
  }
}

/**
 * Handle Mailgun webhook events
 */
async function handleMailgunWebhook(event: any) {
  const emailId = event['user-variables']?.['email-id'];
  
  switch (event.event) {
    case 'bounced':
      if (emailId) {
        emailTrackingService.trackBounce(
          emailId,
          event.severity === 'permanent' ? 'hard' : 'soft'
        );
      }
      break;
    case 'complained':
      if (emailId) {
        emailTrackingService.trackComplaint(emailId);
      }
      break;
  }
}

/**
 * Handle AWS SES webhook events
 */
async function handleSESWebhook(message: any) {
  // Parse SNS message if needed
  const event = typeof message === 'string' ? JSON.parse(message) : message;
  
  if (event.Type === 'Notification') {
    const notification = JSON.parse(event.Message);
    const emailId = notification.mail?.headers?.find(
      (h: any) => h.name === 'X-Email-Id'
    )?.value;
    
    switch (notification.notificationType) {
      case 'Bounce':
        if (emailId) {
          emailTrackingService.trackBounce(
            emailId,
            notification.bounce.bounceType === 'Permanent' ? 'hard' : 'soft'
          );
        }
        break;
      case 'Complaint':
        if (emailId) {
          emailTrackingService.trackComplaint(emailId);
        }
        break;
    }
  }
}

export default emailRoutes;
