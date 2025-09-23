// server.js
import app, { io, httpServer } from './app.js'; // Updated to import io and httpServer
import dotenv from 'dotenv';
import redis from 'redis';
import mongoose from 'mongoose';
import { log, logger } from './Utils/logger.js';
import { __dirname } from './app.js';

dotenv.config({ path: `${__dirname}/config.env` });

const port = process.env.PORT || 3003;

mongoose
  .connect(process.env.DATABASE_URL)
  .then(() => log('Database is connected and ready to use').info().cyan())
  .catch((err) => log(err).error());

const client = redis.createClient({ url: process.env.REDIS_URL });
client.connect().then(() => log('Redis connected').info().cyan());

httpServer.listen(port, () => log(`Server is running on port ${port} :]`).info().green()); // Updated to use httpServer