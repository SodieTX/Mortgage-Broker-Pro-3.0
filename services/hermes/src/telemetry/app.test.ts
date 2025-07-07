import request from 'supertest';
import app from './app';

describe('Hermes API', () => {
  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('POST /transform uppercases string values', async () => {
    const res = await request(app)
      .post('/transform')
      .send({ data: { foo: 'bar', num: 42 } });
    expect(res.status).toBe(200);
    expect(res.body.result).toEqual({ foo: 'BAR', num: 42 });
  });

  it('POST /transform returns 400 for invalid input', async () => {
    const res = await request(app)
      .post('/transform')
      .send({ notdata: 123 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid input');
    expect(res.body.details).toBeDefined();
  });
});
