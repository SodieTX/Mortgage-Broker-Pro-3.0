/**
 * Tests for services index
 * Tests that all exports are properly defined
 */

import * as services from '../index';

describe('services index', () => {
  it('should export email service', () => {
    expect(services.email).toBeDefined();
  });

  it('should export ServiceInitializer', () => {
    expect(services.ServiceInitializer).toBeDefined();
  });

  it('should have all expected exports', () => {
    expect(typeof services.email).toBe('object');
    expect(typeof services.ServiceInitializer).toBe('function');
  });

  it('should export email with expected methods', () => {
    expect(services.email).toHaveProperty('sendEmail');
    expect(services.email).toHaveProperty('sendBulkEmails');
    expect(services.email).toHaveProperty('sendWelcomeEmail');
    expect(services.email).toHaveProperty('sendPasswordResetEmail');
    expect(services.email).toHaveProperty('queueEmail');
  });
});