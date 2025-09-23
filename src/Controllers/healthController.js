// controllers/healthController.js
import mongoose from 'mongoose';
import redis from 'redis';
import catchAsync from '../Utils/catchAsync.js';
import HandleError from '../Utils/handleError.js';
import { io } from '../app.js';
import { logger } from '../Utils/logger.js';

export const healthCheck = catchAsync(async (req, res, next) => {
  try {
    // Check MongoDB status
    const mongoStatus = mongoose.connection.readyState === 1 ? 'UP' : 'DOWN';
    if (mongoStatus === 'DOWN') {
      logger.warn('MongoDB connection is down');
    }

    // Check Redis status
    const redisClient = redis.createClient({ url: process.env.REDIS_URL });
    await redisClient.connect();
    const redisStatus = (await redisClient.ping()) === 'PONG' ? 'UP' : 'DOWN';
    if (redisStatus === 'DOWN') {
      logger.warn('Redis connection is down');
    }
    await redisClient.quit();

    // Compile health status
    const status = {
      mongo: mongoStatus,
      redis: redisStatus,
      timestamp: new Date().toISOString(),
    };

    // Emit health status via Socket.io
    io.emit('healthUpdate', status);

    // Respond with health status
    res.status(200).json({ status: 'SUCCESS', data: status });
  } catch (error) {
    logger.error('Health check failed:', error);
    return next(new HandleError('Health check failed. Contact support.', 500));
  }
});