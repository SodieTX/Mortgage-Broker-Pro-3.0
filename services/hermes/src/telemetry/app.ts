import express from 'express';
import { z } from 'zod';

const app = express();
app.use(express.json());

// Healthcheck endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Zod schema for input validation
const transformSchema = z.object({
  data: z.record(z.any())
});

// /transform endpoint
app.post('/transform', (req, res) => {
  const parseResult = transformSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Invalid input',
      details: parseResult.error.errors
    });
  }
  const { data } = parseResult.data;
  // Example transformation: uppercase all string values
  const result: Record<string, any> = {};
  for (const key in data) {
    result[key] = typeof data[key] === 'string' ? data[key].toUpperCase() : data[key];
  }
  res.json({ result });
});

// Error handler (structured error responses)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

export default app;
