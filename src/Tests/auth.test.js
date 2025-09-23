import mongoose from 'mongoose';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { authRouter } from '../Routes/auth.js';
import Player from '../Models/playerMd.js';
import VerificationToken from '../Models/VerificationTokenMd.js';
import PasswordResetToken from '../Models/PasswordResetTokenMd.js';
import nodemailer from 'nodemailer';
import { validationResult } from 'express-validator';
import winston from 'winston';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

describe('Auth Endpoints', () => {
  let player, token;

  beforeEach(async () => {
    player = await Player.create({
      playerId: new mongoose.Types.ObjectId(),
      username: 'player1',
      email: 'player1@example.com',
      password: await bcrypt.hash('StrongPass123!', 10),
      verified: false,
      role: 'user',
      totalXp: 0,
      groups: [],
      rank: 'bronze',
      lastUpdated: new Date(),
    });

    token = jwt.sign(
      { playerId: player.playerId, role: 'user', rank: 'bronze', groups: [], verified: false },
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
        .send(newUser);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Verification email sent to newuser@example.com');
      expect(res.body).toHaveProperty('verified', false);

      const savedPlayer = await Player.findOne({ email: 'newuser@example.com' });
      expect(savedPlayer).toBeTruthy();
      expect(await bcrypt.compare('StrongPass123!', savedPlayer.password)).toBe(true);

      const verificationToken = await VerificationToken.findOne({ playerId: savedPlayer.playerId });
      expect(verificationToken).toBeTruthy();
      expect(nodemailer.createTransport().sendMail).toHaveBeenCalled();
    });

    it('should return 400 for invalid input (validation middleware)', async () => {
      validationResult.mockImplementation(() => ({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([{ msg: 'Invalid email' }]),
      }));

      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'newuser', email: 'invalid', password: 'weak' });

      expect(res.status).toBe(400);
      expect(res.body.errors).toContainEqual({ msg: 'Invalid email' });
    });
  });

  describe('POST /api/auth/verify-email', () => {
    it('should verify email with valid token', async () => {
      const verificationToken = await VerificationToken.create({
        playerId: player.playerId,
        token: 'valid_token',
        expiresAt: new Date(Date.now() + 3600000),
      });

      const res = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: 'valid_token' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Email verified successfully');

      const updatedPlayer = await Player.findOne({ playerId: player.playerId });
      expect(updatedPlayer.verified).toBe(true);
      expect(await VerificationToken.findOne({ token: 'valid_token' })).toBeNull();
    });

    it('should return 400 for invalid token', async () => {
      const res = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: 'invalid_token' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', 'Invalid or expired token');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should return JWT for valid credentials', async () => {
      await Player.updateOne({ playerId: player.playerId }, { verified: true });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'player1@example.com', password: 'StrongPass123!' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
      expect(decoded).toHaveProperty('playerId', player.playerId.toString());
      expect(decoded).toHaveProperty('role', 'user');
      expect(decoded).toHaveProperty('verified', true);
    });

    it('should return 401 for unverified user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'player1@example.com', password: 'StrongPass123!' });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('message', 'User not verified');
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('should send password reset email', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'player1@example.com' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Password reset link sent');
      expect(nodemailer.createTransport().sendMail).toHaveBeenCalled();

      const resetToken = await PasswordResetToken.findOne({ playerId: player.playerId });
      expect(resetToken).toBeTruthy();
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('should reset password with valid token', async () => {
      const resetToken = await PasswordResetToken.create({
        playerId: player.playerId,
        token: 'valid_reset_token',
        expiresAt: new Date(Date.now() + 3600000),
      });

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'valid_reset_token', newPassword: 'NewPass456!' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Password reset successfully');

      const updatedPlayer = await Player.findOne({ playerId: player.playerId });
      expect(await bcrypt.compare('NewPass456!', updatedPlayer.password)).toBe(true);
      expect(await PasswordResetToken.findOne({ token: 'valid_reset_token' })).toBeNull();
    });
  });
});