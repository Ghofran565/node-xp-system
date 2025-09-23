import mongoose from 'mongoose';
import request from 'supertest';
import express from 'express';
import { leaderboardRouter } from '../Routes/leaderboards.js';
import Player from '../Models/PlayerMd.js';
import Tournament from '../Models/TournamentMd.js';
import { createClient } from 'redis';
import { Server } from 'socket.io';
import { seedDatabase } from '../Utilities/seed.js';

const app = express();
app.use(express.json());
app.use('/api/leaderboards', leaderboardRouter);

describe('Leaderboard Endpoints', () => {
  let player1, player2, tournament;

  beforeEach(async () => {
    await seedDatabase(); // Use seed.js for populated data
    player1 = await Player.findOne({ username: 'player1' });
    player2 = await Player.findOne({ username: 'mod1' });
    tournament = await Tournament.findOne({ name: 'Test Tournament 2025' });
  });

  describe('GET /api/leaderboards', () => {
    it('should return XP leaderboard (leaderboard ranking algorithm)', async () => {
      const redis = createClient();
      redis.get.mockResolvedValueOnce(JSON.stringify([
        { playerId: player1.playerId.toString(), username: 'player1', totalXp: 1500 },
        { playerId: player2.playerId.toString(), username: 'mod1', totalXp: 3000 },
      ]));

      const res = await request(app).get('/api/leaderboards?type=xp');

      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body[0]).toHaveProperty('username', 'mod1');
      expect(res.body[0]).toHaveProperty('totalXp', 3000);
      expect(redis.get).toHaveBeenCalledWith('leaderboard:global');
    });

    it('should return tournament leaderboard', async () => {
      const redis = createClient();
      redis.get.mockResolvedValueOnce(JSON.stringify([
        { playerId: player1.playerId.toString(), username: 'player1', totalXp: 200 },
      ]));

      const socket = Server();

      const res = await request(app)
        .get(`/api/leaderboards?tournamentId=${tournament.tournamentId}`);

      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body[0]).toHaveProperty('username', 'player1');
      expect(socket.emit).toHaveBeenCalledWith('leaderboardUpdate', {
        leaderboard: expect.any(Array),
      });
    });

    it('should cache leaderboard results', async () => {
      const redis = createClient();

      const res = await request(app).get('/api/leaderboards?type=xp');

      expect(redis.set).toHaveBeenCalledWith(
        'leaderboard:global',
        expect.any(String),
        'EX',
        parseInt(process.env.CACHE_TTL)
      );
    });

    it('should handle Redis connection failure', async () => {
      const redis = createClient();
      redis.get.mockRejectedValue(new Error('Redis connection failed'));

      const res = await request(app).get('/api/leaderboards?type=xp');

      expect(res.status).toBe(200); // Fallback to database
      expect(res.body).toBeInstanceOf(Array);
    });
  });
});