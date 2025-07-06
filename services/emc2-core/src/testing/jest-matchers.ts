/**
 * Custom Jest Matchers
 */

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeFinite(): R;
    }
  }
}

expect.extend({
  toBeFinite(received: any) {
    const pass = typeof received === 'number' && isFinite(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be finite`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${received} to be finite`,
        pass: false
      };
    }
  }
});

export {};
