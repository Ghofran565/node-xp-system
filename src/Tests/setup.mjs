// Tests/setup.mjs
import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { createClient } from 'redis';
import { Server } from 'socket.io';
import nodemailer from 'nodemailer';
import winston from 'winston';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { config } from 'dotenv';
import path from 'path';
import { validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';

config({ path: path.resolve(process.cwd(), 'config.env') });

jest.mock('mongoose');
jest.mock('redis');
jest.mock('socket.io');
jest.mock('nodemailer');
jest.mock('winston');
jest.mock('express-validator');
jest.mock('express-rate-limit');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  mongoose.connect.mockResolvedValue({
    connection: { db: { databaseName: 'test-xp-system' } },
  });
  await mongoose.connect(mongoUri);

  createClient.mockReturnValue({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    connect: jest.fn().mockResolvedValue(true),
    quit: jest.fn().mockResolvedValue(true),
  });

  Server.mockImplementation(() => ({
    emit: jest.fn(),
    on: jest.fn(),
    to: jest.fn().mockReturnThis(),
  }));

  nodemailer.createTransport.mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'mocked-email' }),
  });

  winston.createLogger.mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  });

  validationResult.mockImplementation(() => ({
    isEmpty: jest.fn().mockReturnValue(true),
    array: jest.fn().mockReturnValue([]),
  }));

  rateLimit.mockImplementation(() => (req, res, next) => next());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  jest.clearAllMocks();
  const collections = await mongoose.connection.db.collections();
  for (const collection of collections) {
    await collection.deleteMany({});
  }
});

afterEach(async () => {
  jest.resetAllMocks();
});