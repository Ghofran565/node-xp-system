const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const supertest = require('supertest');
const app = require('../index');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

test('POST /api/auth/register should register user', async () => {
  const res = await supertest(app)
    .post('/api/auth/register')
    .send({ username: 'test', email: 'test@example.com', password: 'password123' });
  expect(res.status).toBe(201);
});