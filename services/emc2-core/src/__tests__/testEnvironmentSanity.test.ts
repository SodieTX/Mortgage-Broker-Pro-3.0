// testEnvironmentSanity.test.ts
// Fails fast if DB or Redis is not available for tests

import { Pool } from 'pg';
import Redis from 'ioredis';

describe('Test Environment Sanity', () => {
  let db: Pool;
  let redis: Redis;

  beforeAll(() => {
    db = new Pool({
      connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
    });
    redis = new Redis(process.env.TEST_REDIS_URL || 'redis://localhost:6379');
  });

  afterAll(async () => {
    await db.end();
    await redis.quit();
  });

  it('should connect to Postgres', async () => {
    try {
      const res = await db.query('SELECT 1');
      expect(res.rowCount).toBe(1);
    } catch (err) {
      throw new Error('Cannot connect to Postgres: ' + err.message);
    }
  });

  it('should connect to Redis', async () => {
    try {
      const pong = await redis.ping();
      expect(pong).toBe('PONG');
    } catch (err) {
      throw new Error('Cannot connect to Redis: ' + err.message);
    }
  });
});
