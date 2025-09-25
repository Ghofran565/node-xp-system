import mongoose from 'mongoose';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import leaderboardRouter from '../Routes/leaderboards.js';
import PlayerMd from '../Models/PlayerMd.js';
import TournamentMd from '../Models/TournamentMd.js';
import RankMd from '../Models/RankMd.js';
import GroupMd from '../Models/GroupMd.js';
import { redis, helmetMiddleware } from './setup.mjs';

const app = express();
app.use(helmetMiddleware);
app.use(express.json());
app.use('/api/leaderboards', leaderboardRouter);

describe('Leaderboard Endpoints', () => {
  let player1, player2, tournament, silverRank, goldRank, group, token;

  beforeEach(async () => {
    silverRank = await RankMd.create({
      rankId: new mongoose.Types.ObjectId(),
      rankName: 'silver',
      minXp: 1000,
      xpBooster: 1.5,
    });

    goldRank = await RankMd.create({
      rankId: new mongoose.Types.ObjectId(),
      rankName: 'gold',
      minXp: 2000,
      xpBooster: 2.0,
    });

    group = await GroupMd.create({
      groupId: new mongoose.Types.ObjectId(),
      groupName: 'dedicated',
      xpBooster: 1.2,
    });

    player1 = await PlayerMd.create({
      playerId: new mongoose.Types.ObjectId(),
      username: 'player1',
      email: 'player1@example.com',
      password: 'hashedPass',
      verified: true,
      role: 'user',
      totalXp: 1500,
      groups: [group._id],
      rank: silverRank._id,
      lastUpdated: new Date(),
    });

    player2 = await PlayerMd.create({
      playerId: new mongoose.Types.ObjectId(),
      username: 'player2',
      email: 'player2@example.com',
      password: 'hashedPass',
      verified: true,
      role: 'user',
      totalXp: 2000,
      groups: [group._id],
      rank: goldRank._id,
      lastUpdated: new Date(),
    });

    tournament = await TournamentMd.create({
      tournamentId: new mongoose.Types.ObjectId(),
      name: 'Test Tournament',
      startTime: new Date(),
      endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      participants: [player1.playerId, player2.playerId],
      tournamentGroups: [group._id],
    });

    token = jwt.sign(
      { playerId: player1.playerId, role: 'user', rank: silverRank.rankName, groups: [group.groupName], verified: true },
      process.env.JWT_SECRET
    );
  });

  describe('GET /api/leaderboards', () => {
    it('should return global XP leaderboard', async () => {
      const res = await request(app)
        .get('/api/leaderboards?type=xp')
        .set('Authorization', `Bearer ${token}`)
        .expect('X-Content-Type-Options', 'nosniff');

      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body[0]).toHaveProperty('username', 'player2');
      expect(res.body[0]).toHaveProperty('totalXp', 2000);
      expect(res.body[0]).toHaveProperty('rank', goldRank.rankName);
      expect(res.body[1]).toHaveProperty('username', 'player1');
      expect(res.body[1]).toHaveProperty('totalXp', 1500);
      expect(res.body[1]).toHaveProperty('rank', silverRank.rankName);
    });

    it('should return tournament leaderboard', async () => {
      await PlayerMd.updateOne({ playerId: player1.playerId }, { totalXp: 1800 });
      await PlayerMd.updateOne({ playerId: player2.playerId }, { totalXp: 2200 });

      const res = await request(app)
        .get(`/api/leaderboards?tournamentId=${tournament.tournamentId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect('X-Content-Type-Options', 'nosniff');

      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body[0]).toHaveProperty('username', 'player2');
      expect(res.body[0]).toHaveProperty('totalXp', 2200);
      expect(res.body[0]).toHaveProperty('rank', goldRank.rankName);
      expect(res.body[1]).toHaveProperty('username', 'player1');
      expect(res.body[1]).toHaveProperty('totalXp', 1800);
      expect(res.body[1]).toHaveProperty('rank', silverRank.rankName);
    });

    it('should return 400 for invalid tournamentId', async () => {
      const res = await request(app)
        .get('/api/leaderboards?tournamentId=invalid_id')
        .set('Authorization', `Bearer ${token}`)
        .expect('X-Content-Type-Options', 'nosniff');

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeInstanceOf(Array);
      expect(res.body.errors.some(err => err.msg === 'Invalid tournamentId')).toBe(true);
    });

    it('should return 401 for unverified user', async () => {
      const unverifiedToken = jwt.sign(
        { playerId: player1.playerId, role: 'user', rank: silverRank.rankName, groups: [group.groupName], verified: false },
        process.env.JWT_SECRET
      );

      const res = await request(app)
        .get('/api/leaderboards?type=xp')
        .set('Authorization', `Bearer ${unverifiedToken}`)
        .expect('X-Content-Type-Options', 'nosniff');

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('message', 'User not verified');
    });
  });
});