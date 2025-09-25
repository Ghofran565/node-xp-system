import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import healthRouter from '../Routes/health.js';
import { redis, helmetMiddleware } from './setup.mjs';

const app = express();
app.use(helmetMiddleware);
app.use(express.json());
app.use('/api/health', healthRouter);

describe('Health Endpoints', () => {
  describe('GET /api/health', () => {
    it('should return 200 with healthy status for all services', async () => {
      const res = await request(app)
        .get('/api/health')
        .expect('X-Content-Type-Options', 'nosniff')
        .expect('Content-Security-Policy', expect.any(String));

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'healthy');
      expect(res.body).toHaveProperty('database', 'connected');
      expect(res.body).toHaveProperty('cache', 'connected');
    });

    it('should return 503 if database is disconnected', async () => {
      await mongoose.disconnect();

      const res = await request(app)
        .get('/api/health')
        .expect('X-Content-Type-Options', 'nosniff');

      expect(res.status).toBe(503);
      expect(res.body).toHaveProperty('status', 'unhealthy');
      expect(res.body).toHaveProperty('database', 'disconnected');
    });

    it('should return 503 if redis is disconnected', async () => {
      await redis.quit();

      const res = await request(app)
        .get('/api/health')
        .expect('X-Content-Type-Options', 'nosniff');

      expect(res.status).toBe(503);
      expect(res.body).toHaveProperty('status', 'unhealthy');
      expect(res.body).toHaveProperty('cache', 'disconnected');
    });
  });
});