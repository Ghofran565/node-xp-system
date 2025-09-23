import mongoose from 'mongoose';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { playerRouter } from '../Routes/players.js';
import Player from '../Models/PlayerMd.js';
import Rank from '../Models/RankMd.js';
import PlayerTaskProgress from '../Models/PlayerTaskProgressMd.js';
import Task from '../Models/TaskMd.js';
import AuditLog from '../Models/AuditLogMd.js';
import winston from 'winston';

const app = express();
app.use(express.json());
app.use('/api/players', playerRouter);

describe('Player Endpoints', () => {
  let player, admin, task, token, adminToken;

  beforeEach(async () => {
    player = await Player.create({
      playerId: new mongoose.Types.ObjectId(),
      username: 'player1',
      email: 'player1@example.com',
      password: 'hashedPass',
      verified: true,
      role: 'user',
      totalXp: 1500,
      groups: ['dedicated'],
      rank: 'silver',
      lastUpdated: new Date(),
    });

    admin = await Player.create({
      playerId: new mongoose.Types.ObjectId(),
      username: 'admin1',
      email: 'admin1@example.com',
      password: 'hashedPass',
      verified: true,
      role: 'admin',
      totalXp: 6000,
      groups: ['special'],
      rank: 'diamond',
      lastUpdated: new Date(),
    });

    await Rank.insertMany([
      { rankId: new mongoose.Types.ObjectId(), rankName: 'silver', minXp: 1000, xpBooster: 1.5 },
      { rankId: new mongoose.Types.ObjectId(), rankName: 'gold', minXp: 2500, xpBooster: 2 },
    ]);

    task = await Task.create({
      taskId: new mongoose.Types.ObjectId(),
      title: 'Daily Task',
      xpReward: 50,
      maxCompletions: 5,
      category: 1,
      groups: ['global'],
    });

    await PlayerTaskProgress.create({
      playerId: player.playerId,
      taskId: task.taskId,
      completions: 2,
      lastCompleted: new Date(),
    });

    token = jwt.sign(
      { playerId: player.playerId, role: 'user', rank: 'silver', groups: ['dedicated'], verified: true },
      process.env.JWT_SECRET
    );
    adminToken = jwt.sign(
      { playerId: admin.playerId, role: 'admin', rank: 'diamond', groups: ['special'], verified: true },
      process.env.JWT_SECRET
    );
  });

  describe('GET /api/players/:playerId/progress', () => {
    it('should return player progress', async () => {
      const res = await request(app)
        .get(`/api/players/${player.playerId}/progress`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalXp', 1500);
      expect(res.body).toHaveProperty('rank', 'silver');
      expect(res.body.progress[0]).toHaveProperty('taskId', task.taskId.toString());
      expect(res.body.progress[0]).toHaveProperty('completions', 2);
    });

    it('should return 403 for unauthorized access', async () => {
      const otherToken = jwt.sign(
        { playerId: new mongoose.Types.ObjectId(), role: 'user', rank: 'bronze', groups: [], verified: true },
        process.env.JWT_SECRET
      );

      const res = await request(app)
        .get(`/api/players/${player.playerId}/progress`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('message', 'Unauthorized access');
    });

    it('should flag suspicious XP gain (anomaly detection algorithm)', async () => {
      await Player.updateOne({ playerId: player.playerId }, { totalXp: 10000 });
      await AuditLog.create({
        action: 'xp_update',
        playerId: player.playerId,
        details: { xpAwarded: 8500, timestamp: new Date() },
        timestamp: new Date(),
      });

      const res = await request(app)
        .get(`/api/players/${player.playerId}/progress`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(winston.createLogger().warn).toHaveBeenCalledWith(
        expect.stringContaining('Suspicious XP gain: 8500 XP in 1 hour')
      );
    });
  });

  describe('GET /api/players/:playerId/rank', () => {
    it('should return rank and XP to next rank (rank update algorithm)', async () => {
      const res = await request(app)
        .get(`/api/players/${player.playerId}/rank`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('rank', 'silver');
      expect(res.body).toHaveProperty('xpToNextRank', 1000); // 2500 - 1500
    });
  });

  describe('Admin Endpoints', () => {
    it('should return all players', async () => {
      const res = await request(app)
        .get('/api/players/all')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBe(2);
    });

    it('should update player details', async () => {
      const res = await request(app)
        .put(`/api/players/${player.playerId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'moderator', groups: ['special'] });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('role', 'moderator');
      expect(res.body.groups).toContain('special');
      expect(winston.createLogger().info).toHaveBeenCalledWith(expect.stringContaining('Player updated'));
    });
  });
});