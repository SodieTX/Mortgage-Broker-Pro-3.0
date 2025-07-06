/**
 * Test Email Initialization
 * 
 * Run this file to test if the email service initializes without hanging
 */

import { email } from './services/email';
import { logger } from './utils/logger';

async function testEmailInit() {
  logger.info('Starting email service initialization test...');
  
  const startTime = Date.now();
  
  try {
    // Test sending an email (this will trigger initialization)
    logger.info('Attempting to send test email...');
    
    const result = await email.sendEmail({
      to: 'test@example.com',
      subject: 'Test Email - Initialization',
      html: '<p>This is a test email to verify initialization works properly.</p>',
      text: 'This is a test email to verify initialization works properly.'
    });
    
    const duration = Date.now() - startTime;
    logger.info(`Email service initialized and test email ${result ? 'sent' : 'failed'} in ${duration}ms`);
    
    process.exit(0);
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`Email service initialization failed after ${duration}ms:`, error);
    process.exit(1);
  }
}

// Add timeout to prevent hanging
const timeout = setTimeout(() => {
  logger.error('Email service initialization timed out after 30 seconds');
  process.exit(1);
}, 30000);

// Run the test
testEmailInit().finally(() => {
  clearTimeout(timeout);
});
