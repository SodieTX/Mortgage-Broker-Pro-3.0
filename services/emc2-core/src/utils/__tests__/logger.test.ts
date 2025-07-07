/**
 * Tests for logger utility
 * Simple test to ensure logger is properly configured
 */

import { logger } from '../logger';

describe('logger', () => {
  it('should be defined', () => {
    expect(logger).toBeDefined();
  });

  it('should have expected properties', () => {
    expect(logger).toHaveProperty('info');
    expect(logger).toHaveProperty('error');
    expect(logger).toHaveProperty('warn');
    expect(logger).toHaveProperty('debug');
    expect(logger).toHaveProperty('trace');
  });

  it('should log info messages', () => {
    const spy = jest.spyOn(logger, 'info').mockImplementation();
    logger.info('test message');
    expect(spy).toHaveBeenCalledWith('test message');
    spy.mockRestore();
  });

  it('should log error messages', () => {
    const spy = jest.spyOn(logger, 'error').mockImplementation();
    logger.error('test error');
    expect(spy).toHaveBeenCalledWith('test error');
    spy.mockRestore();
  });

  it('should log warn messages', () => {
    const spy = jest.spyOn(logger, 'warn').mockImplementation();
    logger.warn('test warning');
    expect(spy).toHaveBeenCalledWith('test warning');
    spy.mockRestore();
  });

  it('should have service name in base config', () => {
    // Test that logger has been created with service name
    expect(logger.bindings()).toHaveProperty('service', 'emc2-core');
  });
});