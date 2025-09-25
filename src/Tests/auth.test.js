import mongoose from 'mongoose';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import authRouter from '../Routes/auth.js';
import PlayerMd from '../Models/PlayerMd.js';
import VerificationTokenMd from '../Models/VerificationTokenMd.js';
import PasswordResetTokenMd from '../Models/PasswordResetTokenMd.js';
import RankMd from '../Models/RankMd.js';
import GroupMd from '../Models/GroupMd.js';
import { logger, transporter, validationResult, helmetMiddleware } from './setup.mjs';

const app = express();
app.use(helmetMiddleware);
app.use(express.json());
app.use('/api/auth', authRouter);

describe('Auth Endpoints', () => {
  let player, rank, group, token;

  beforeEach(async () => {
    rank = await RankMd.create({
      rankId: new mongoose.Types.ObjectId(),
      rankName: 'bronze',
      minXp: 0,
      xpBooster: 1.0,
    });

    group = await GroupMd.create({
      groupId: new mongoose.Types.ObjectId(),
      groupName: 'dedicated',
      xpBooster: 1.2,
    });

    player = await PlayerMd.create({
      playerId: new mongoose.Types.ObjectId(),
      username: 'player1',
      email: 'player1@example.com',
      password: await bcrypt.hash('StrongPass123!', 10),
      verified: false,
      role: 'user',
      totalXp: 0,
      groups: [group._id],
      rank: rank._id,
      lastUpdated: new Date(),
    });

    token = jwt.sign(
      { playerId: player.playerId, role: 'user', rank: rank.rankName, groups: [group.groupName], verified: false },
      process.env.JWT_SECRET
    );
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user and send verification email', async () => {
      const newUser = {
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'StrongPass123!',
      };

      const res = await request(app)
        .post('/api/auth/register')
        .send(newUser)
        .expect('X-Content-Type-Options', 'nosniff');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Verification email sent to newuser@example.com');
      expect(res.body).toHaveProperty('verified', false);

      const savedPlayer = await PlayerMd.findOne({ email: 'newuser@example.com' });
      expect(savedPlayer).toBeTruthy();
      expect(await bcrypt.compare('StrongPass123!', savedPlayer.password)).toBe(true);
      expect(savedPlayer.rank.toString()).toBe(rank._id.toString());
      expect(savedPlayer.groups[0].toString()).toBe(group._id.toString());

      const verificationToken = await VerificationTokenMd.findOne({ playerId: savedPlayer.playerId });
      expect(verificationToken).toBeTruthy();
    });

    it('should return 400 for invalid input', async () => {
      const invalidUser = {
        username: 'newuser',
        email: 'invalid',
        password: 'weak',
      };

      const res = await request(app)
        .post('/api/auth/register')
        .send(invalidUser)
        .expect('X-Content-Type-Options', 'nosniff');

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeInstanceOf(Array);
      expect(res.body.errors.some(err => err.msg === 'Invalid email')).toBe(true);
    });

    it('should log error for invalid email recipient', async () => {
      const newUser = {
        username: 'newuser',
        email: 'invalid@example.com',
        password: 'StrongPass123!',
      };

      const logSpy = jest.spyOn(logger, 'error');

      const res = await request(app)
        .post('/api/auth/register')
        .send(newUser)
        .expect('X-Content-Type-Options', 'nosniff');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', 'Failed to send verification email');
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid recipient'));
      logSpy.mockRestore();
    });
  });

  describe('POST /api/auth/verify-email', () => {
    it('should verify email with valid token', async () => {
      const verificationToken = await VerificationTokenMd.create({
        playerId: player.playerId,
        token: 'valid_token',
        expiresAt: new Date(Date.now() + 3600000),
      });

      const res = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: 'valid_token' })
        .expect('X-Content-Type-Options', 'nosniff');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Email verified successfully');

      const updatedPlayer = await PlayerMd.findOne({ playerId: player.playerId });
      expect(updatedPlayer.verified).toBe(true);
      expect(await VerificationTokenMd.findOne({ token: 'valid_token' })).toBeNull();
    });

    it('should return 400 for invalid token', async () => {
      const res = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: 'invalid_token' })
        .expect('X-Content-Type-Options', 'nosniff');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', 'Invalid or expired token');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should return JWT for valid credentials', async () => {
      await PlayerMd.updateOne({ playerId: player.playerId }, { verified: true });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'player1@example.com', password: 'StrongPass123!' })
        .expect('X-Content-Type-Options', 'nosniff');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
      expect(decoded).toHaveProperty('playerId', player.playerId.toString());
      expect(decoded).toHaveProperty('role', 'user');
      expect(decoded).toHaveProperty('rank', rank.rankName);
      expect(decoded).toHaveProperty('groups', [group.groupName]);
      expect(decoded).toHaveProperty('verified', true);
    });

    it('should return 401 for unverified user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'player1@example.com', password: 'StrongPass123!' })
        .expect('X-Content-Type-Options', 'nosniff');

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('message', 'User not verified');
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('should send password reset email', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'player1@example.com' })
        .expect('X-Content-Type-Options', 'nosniff');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Password reset link sent');

      const resetToken = await PasswordResetTokenMd.findOne({ playerId: player.playerId });
      expect(resetToken).toBeTruthy();
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('should reset password with valid token', async () => {
      const resetToken = await PasswordResetTokenMd.create({
        playerId: player.playerId,
        token: 'valid_reset_token',
        expiresAt: new Date(Date.now() + 3600000),
      });

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'valid_reset_token', newPassword: 'NewPass456!' })
        .expect('X-Content-Type-Options', 'nosniff');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Password reset successfully');

      const updatedPlayer = await PlayerMd.findOne({ playerId: player.playerId });
      expect(await bcrypt.compare('NewPass456!', updatedPlayer.password)).toBe(true);
      expect(await PasswordResetTokenMd.findOne({ token: 'valid_reset_token' })).toBeNull();
    });
  });
});