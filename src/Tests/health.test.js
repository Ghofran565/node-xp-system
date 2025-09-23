import request from 'supertest';
import express from 'express';
import { healthRouter } from '../Routes/health.js';
import mongoose from 'mongoose';
import { createClient } from 'redis';

const app = express();
app.use(express.json());
app.use('/api/health', healthRouter);

describe('Health Endpoint', () => {
  it('should return system status', async () => {
    const redis = createClient();
    redis.connect.mockResolvedValue(true);

    mongoose.connection.db = { collections: jest.fn().mockResolvedValue([]) };

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'healthy');
    expect(res.body).toHaveProperty('database', 'connected');
    expect(res.body).toHaveProperty('cache', 'connected');
  });

  it('should return 503 if Redis connection fails', async () => {
    const redis = createClient();
    redis.connect.mockRejectedValue(new Error('Redis connection failed'));

    mongoose.connection.db = { collections: jest.fn().mockResolvedValue([]) };

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(503);
    expect(res.body).toHaveProperty('status', 'unhealthy');
    expect(res.body).toHaveProperty('cache', 'disconnected');
  });
});