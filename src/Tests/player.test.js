import mongoose from 'mongoose';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import playerRouter from '../Routes/players.js';
import PlayerMd from '../Models/PlayerMd.js';
import RankMd from '../Models/RankMd.js';
import GroupMd from '../Models/GroupMd.js';
import { redis, helmetMiddleware } from './setup.mjs';

const app = express();
app.use(helmetMiddleware);
app.use(express.json());
app.use('/api/players', playerRouter);

describe('Player Endpoints', () => {
  let player, admin, silverRank, goldRank, diamondRank, group, token, adminToken;

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

    diamondRank = await RankMd.create({
      rankId: new mongoose.Types.ObjectId(),
      rankName: 'diamond',
      minXp: 5000,
      xpBooster: 3.0,
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
      password: 'hashedPass',
      verified: true,
      role: 'user',
      totalXp: 1500,
      groups: [group._id],
      rank: silverRank._id,
      lastUpdated: new Date(),
    });

    admin = await PlayerMd.create({
      playerId: new mongoose.Types.ObjectId(),
      username: 'admin1',
      email: 'admin1@example.com',
      password: 'hashedPass',
      verified: true,
      role: 'admin',
      totalXp: 6000,
      groups: [group._id],
      rank: diamondRank._id,
      lastUpdated: new Date(),
    });

    await GroupMd.create({
      groupId: new mongoose.Types.ObjectId(),
      groupName: 'special',
      xpBooster: 1.5,
    });

    token = jwt.sign(
      { playerId: player.playerId, role: 'user', rank: silverRank.rankName, groups: [group.groupName], verified: true },
      process.env.JWT_SECRET
    );
    adminToken = jwt.sign(
      { playerId: admin.playerId, role: 'admin', rank: diamondRank.rankName, groups: [group.groupName], verified: true },
      process.env.JWT_SECRET
    );
  });

  describe('GET /api/players/:playerId/progress', () => {
    it('should return progress for authenticated player', async () => {
      const res = await request(app)
        .get(`/api/players/${player.playerId}/progress`)
        .set('Authorization', `Bearer ${token}`)
        .expect('X-Content-Type-Options', 'nosniff');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalXp', 1500);
      expect(res.body).toHaveProperty('rank', silverRank.rankName);
      expect(res.body).toHaveProperty('groups', [group.groupName]);
    });

    it('should return 403 for unauthorized access', async () => {
      const otherPlayer = await PlayerMd.create({
        playerId: new mongoose.Types.ObjectId(),
        username: 'player2',
        email: 'player2@example.com',
        password: 'hashedPass',
        verified: true,
        role: 'user',
        totalXp: 1000,
        groups: [group._id],
        rank: silverRank._id,
        lastUpdated: new Date(),
      });

      const res = await request(app)
        .get(`/api/players/${otherPlayer.playerId}/progress`)
        .set('Authorization', `Bearer ${token}`)
        .expect('X-Content-Type-Options', 'nosniff');

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('message', 'Unauthorized access');
    });

    it('should allow admin to view any player progress', async () => {
      const res = await request(app)
        .get(`/api/players/${player.playerId}/progress`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect('X-Content-Type-Options', 'nosniff');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalXp', 1500);
      expect(res.body).toHaveProperty('rank', silverRank.rankName);
    });
  });

  describe('GET /api/players/:playerId/rank', () => {
    it('should return rank and XP to next rank', async () => {
      const res = await request(app)
        .get(`/api/players/${player.playerId}/rank`)
        .set('Authorization', `Bearer ${token}`)
        .expect('X-Content-Type-Options', 'nosniff');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('rank', silverRank.rankName);
      expect(res.body).toHaveProperty('xpToNextRank', 500); // 2000 (gold) - 1500
    });
  });

  describe('Admin Endpoints', () => {
    describe('GET /api/players/all', () => {
      it('should return all players for admin', async () => {
        const res = await request(app)
          .get('/api/players/all')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect('X-Content-Type-Options', 'nosniff');

        expect(res.status).toBe(200);
        expect(res.body).toBeInstanceOf(Array);
        expect(res.body.length).toBe(2);
        expect(res.body.some(p => p.username === 'player1')).toBe(true);
      });

      it('should return 403 for non-admin', async () => {
        const res = await request(app)
          .get('/api/players/all')
          .set('Authorization', `Bearer ${token}`)
          .expect('X-Content-Type-Options', 'nosniff');

        expect(res.status).toBe(403);
        expect(res.body).toHaveProperty('message', 'Admin access required');
      });
    });

    describe('PUT /api/players/:playerId', () => {
      it('should update player details for admin', async () => {
        const res = await request(app)
          .put(`/api/players/${player.playerId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ role: 'moderator', groups: [group._id], rank: diamondRank._id })
          .expect('X-Content-Type-Options', 'nosniff');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('role', 'moderator');
        expect(res.body).toHaveProperty('groups', [group.groupName]);
        expect(res.body).toHaveProperty('rank', diamondRank.rankName);

        const updatedPlayer = await PlayerMd.findOne({ playerId: player.playerId });
        expect(updatedPlayer.role).toBe('moderator');
        expect(updatedPlayer.groups[0].toString()).toBe(group._id.toString());
        expect(updatedPlayer.rank.toString()).toBe(diamondRank._id.toString());
      });
    });
  });

  describe('Anomaly Detection', () => {
    it('should flag suspicious XP gains', async () => {
      const logSpy = jest.spyOn(logger, 'warn');
      await PlayerMd.updateOne({ playerId: player.playerId }, { totalXp: 10000 }); // Suspiciously high

      const res = await request(app)
        .get(`/api/players/${player.playerId}/progress`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect('X-Content-Type-Options', 'nosniff');

      expect(res.status).toBe(200);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Suspicious XP gain'));
      logSpy.mockRestore();
    });
  });
});