// Tests/setup.mjs
import mongoose from 'mongoose';
import Redis from 'ioredis';
import { Server } from 'socket.io';
import http from 'http';
import nodemailer from 'nodemailer';
import winston from 'winston';
import helmet from 'helmet';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { config } from 'dotenv';
import path from 'path';
import { validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { PassThrough } from 'stream';

// Configure winston with a null transport
const logger = winston.createLogger({
	transports: [new winston.transports.Stream({ stream: new PassThrough() })],
});

// Configure nodemailer with a test transport
const transporter = nodemailer.createTransport({
	streamTransport: true,
	newline: 'unix',
	buffer: true,
});

// Configure Redis with in-memory configuration
const redis = new Redis({ enableOfflineQueue: false });

// Configure Socket.io with a dummy HTTP server
const httpServer = http.createServer();
const io = new Server(httpServer);

// Configure rate-limit with in-memory store
const rateLimiter = rateLimit({
	windowMs: 60 * 1000,
	max: 50,
	standardHeaders: true,
	legacyHeaders: false,
});

// Configure helmet
const helmetMiddleware = helmet();

config({ path: path.resolve(process.cwd(), 'config.env') });

let mongoServer;

beforeAll(async () => {
	mongoServer = await MongoMemoryServer.create({
		binary: {
			checkMD5: false, // Skip MD5 check temporarily
		},
	});
	const mongoUri = mongoServer.getUri();
	await mongoose.connect(mongoUri);
});

afterAll(async () => {
	await mongoose.disconnect();
	await redis.quit();
	httpServer.close();
	await mongoServer.stop();
});

beforeEach(async () => {
	const collections = await mongoose.connection.db.collections();
	for (const collection of collections) {
		await collection.deleteMany({});
	}
	await redis.flushall();
});

afterEach(async () => {
	// No mocks to reset
});

// Export dependencies for use in tests
export {
	logger,
	transporter,
	redis,
	io,
	rateLimiter,
	validationResult,
	helmetMiddleware,
};
