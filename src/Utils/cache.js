import Redis from 'ioredis';
import { securityConfig } from './config.js';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  ttl: securityConfig.cache.ttl, // Default TTL from config (10 minutes)
});

redis.on('error', (error) => {
  console.error('Redis connection error:', error);
});

const set = async (key, value, ttl = securityConfig.cache.ttl, options = {}) => {
  const stringValue = typeof value === 'object' ? JSON.stringify(value) : value;
  await redis.set(key, stringValue, 'EX', ttl);
  if (options.async) return Promise.resolve();
  return;
};

const get = async (key) => {
  const value = await redis.get(key);
  return value ? JSON.parse(value) : null;
};

const del = async (key) => {
  await redis.del(key);
};

const delPattern = async (pattern) => {
  const keys = await redis.keys(`${pattern}*`);
  if (keys.length > 0) await redis.del(keys);
};

export const cache = { set, get, del, delPattern };