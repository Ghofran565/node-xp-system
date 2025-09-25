import mongoose from 'mongoose';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import taskRouter from '../Routes/tasks.js';
import TaskMd from '../Models/TaskMd.js';
import PlayerMd from '../Models/PlayerMd.js';
import PlayerTaskProgressMd from '../Models/PlayerTaskProgressMd.js';
import RankMd from '../Models/RankMd.js';
import GroupMd from '../Models/GroupMd.js';
import TournamentMd from '../Models/TournamentMd.js';
import { redis, io, rateLimiter, validationResult, helmetMiddleware } from './setup.mjs';

const app = express();
app.use(helmetMiddleware);
app.use(express.json());
app.use(rateLimiter);
app.use('/api/tasks', taskRouter);

describe('Task Endpoints', () => {
  let player, admin, task, tournament, silverRank, diamondRank, group;
  let token, adminToken;

  beforeEach(async () => {
    silverRank = await RankMd.create({
      rankId: new mongoose.Types.ObjectId(),
      rankName: 'silver',
      minXp: 1000,
      xpBooster: 1.5,
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

    tournament = await TournamentMd.create({
      tournamentId: new mongoose.Types.ObjectId(),
      name: 'Test Tournament',
      startTime: new Date(),
      endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      participants: [player.playerId],
      tournamentGroups: [group._id],
    });

    task = await TaskMd.create({
      taskId: new mongoose.Types.ObjectId(),
      title: 'Daily Task',
      xpReward: 50,
      maxCompletions: 5,
      cooldown: 24 * 60 * 60 * 1000,
      category: 1,
      startTime: new Date(),
      endTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
      groups: ['global'],
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

  describe('GET /api/tasks/assigned', () => {
    it('should return tasks eligible for the player', async () => {
      const res = await request(app)
        .get('/api/tasks/assigned')
        .set('Authorization', `Bearer ${token}`)
        .expect('X-Content-Type-Options', 'nosniff');

      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body[0]).toHaveProperty('taskId', task.taskId.toString());
      expect(res.body[0]).toHaveProperty('title', 'Daily Task');
    });

    it('should return 401 for unverified user', async () => {
      const unverifiedToken = jwt.sign(
        { playerId: player.playerId, role: 'user', rank: silverRank.rankName, groups: [group.groupName], verified: false },
        process.env.JWT_SECRET
      );

      const res = await request(app)
        .get('/api/tasks/assigned')
        .set('Authorization', `Bearer ${unverifiedToken}`)
        .expect('X-Content-Type-Options', 'nosniff');

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('message', 'User not verified');
    });

    it('should return 401 for invalid JWT', async () => {
      const res = await request(app)
        .get('/api/tasks/assigned')
        .set('Authorization', 'Bearer invalid_token')
        .expect('X-Content-Type-Options', 'nosniff');

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('message', expect.stringContaining('Invalid token'));
    });
  });

  describe('GET /api/tasks/:taskId', () => {
    it('should return task details if eligible', async () => {
      const res = await request(app)
        .get(`/api/tasks/${task.taskId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect('X-Content-Type-Options', 'nosniff');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('taskId', task.taskId.toString());
      expect(res.body).toHaveProperty('title', 'Daily Task');
    });

    it('should return 403 if player is not eligible', async () => {
      await TaskMd.updateOne({ taskId: task.taskId }, { groups: ['special'] });

      const res = await request(app)
        .get(`/api/tasks/${task.taskId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect('X-Content-Type-Options', 'nosniff');

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('message', 'Not eligible for this task');
    });

    it('should return 403 for expired task', async () => {
      await TaskMd.updateOne(
        { taskId: task.taskId },
        { endTime: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      );

      const res = await request(app)
        .get(`/api/tasks/${task.taskId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect('X-Content-Type-Options', 'nosniff');

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('message', 'Task has expired');
    });
  });

  describe('POST /api/tasks/:taskId/complete', () => {
    it('should complete task and award XP', async () => {
      const res = await request(app)
        .post(`/api/tasks/${task.taskId}/complete`)
        .set('Authorization', `Bearer ${token}`)
        .expect('X-Content-Type-Options', 'nosniff');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('xpAwarded', 110); // 50 * (1.5 + 1.2) = 110
      expect(res.body).toHaveProperty('newTotalXp', 1610); // 1500 + 110

      const updatedPlayer = await PlayerMd.findOne({ playerId: player.playerId });
      expect(updatedPlayer.totalXp).toBe(1610);
    });

    it('should return 429 for rate limit exceeded', async () => {
      for (let i = 0; i < 50; i++) {
        await request(app)
          .post(`/api/tasks/${task.taskId}/complete`)
          .set('Authorization', `Bearer ${token}`);
      }

      const res = await request(app)
        .post(`/api/tasks/${task.taskId}/complete`)
        .set('Authorization', `Bearer ${token}`)
        .expect('X-Content-Type-Options', 'nosniff');

      expect(res.status).toBe(429);
      expect(res.body).toHaveProperty('message', 'Too many requests');
    });

    it('should return 400 for invalid taskId', async () => {
      const res = await request(app)
        .post(`/api/tasks/invalid_id/complete`)
        .set('Authorization', `Bearer ${token}`)
        .expect('X-Content-Type-Options', 'nosniff');

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeInstanceOf(Array);
      expect(res.body.errors.some(err => err.msg === 'Invalid taskId')).toBe(true);
    });

    it('should return 403 for max completions reached', async () => {
      await PlayerTaskProgressMd.create({
        playerId: player.playerId,
        taskId: task.taskId,
        completions: 5,
        lastCompleted: new Date(),
      });

      const res = await request(app)
        .post(`/api/tasks/${task.taskId}/complete`)
        .set('Authorization', `Bearer ${token}`)
        .expect('X-Content-Type-Options', 'nosniff');

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('message', 'Maximum completions reached');
    });
  });

  describe('Admin Endpoints', () => {
    describe('GET /api/tasks/all', () => {
      it('should return all tasks for admin', async () => {
        const res = await request(app)
          .get('/api/tasks/all')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect('X-Content-Type-Options', 'nosniff');

        expect(res.status).toBe(200);
        expect(res.body).toBeInstanceOf(Array);
        expect(res.body[0]).toHaveProperty('taskId', task.taskId.toString());
      });

      it('should return 403 for non-admin', async () => {
        const res = await request(app)
          .get('/api/tasks/all')
          .set('Authorization', `Bearer ${token}`)
          .expect('X-Content-Type-Options', 'nosniff');

        expect(res.status).toBe(403);
        expect(res.body).toHaveProperty('message', 'Admin access required');
      });
    });

    describe('POST /api/tasks', () => {
      it('should create a new task for admin', async () => {
        const newTask = {
          title: 'New Task',
          xpReward: 100,
          maxCompletions: 3,
          cooldown: 3600000,
          category: 1,
          groups: ['global'],
          startTime: new Date(),
          endTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        };

        const res = await request(app)
          .post('/api/tasks')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(newTask)
          .expect('X-Content-Type-Options', 'nosniff');

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('title', 'New Task');
      });
    });

    describe('PUT /api/tasks/:taskId', () => {
      it('should update a task for admin', async () => {
        const res = await request(app)
          .put(`/api/tasks/${task.taskId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ title: 'Updated Task' })
          .expect('X-Content-Type-Options', 'nosniff');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('title', 'Updated Task');
      });
    });

    describe('DELETE /api/tasks/:taskId', () => {
      it('should delete a task for admin', async () => {
        const res = await request(app)
          .delete(`/api/tasks/${task.taskId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect('X-Content-Type-Options', 'nosniff');

        expect(res.status).toBe(204);
        expect(await TaskMd.findOne({ taskId: task.taskId })).toBeNull();
      });
    });
  });

  describe('Task Eligibility Algorithm', () => {
    it('should include tasks with matching groups', async () => {
      await TaskMd.create({
        taskId: new mongoose.Types.ObjectId(),
        title: 'Dedicated Task',
        xpReward: 100,
        category: 1,
        groups: [group._id],
      });

      const res = await request(app)
        .get('/api/tasks/assigned')
        .set('Authorization', `Bearer ${token}`)
        .expect('X-Content-Type-Options', 'nosniff');

      expect(res.status).toBe(200);
      expect(res.body.some(task => task.title === 'Dedicated Task')).toBe(true);
    });

    it('should include tournament tasks for participants', async () => {
      await TaskMd.create({
        taskId: new mongoose.Types.ObjectId(),
        title: 'Tournament Task',
        xpReward: 200,
        category: 0,
        tournamentId: tournament.tournamentId,
        groups: [group._id],
      });

      const res = await request(app)
        .get('/api/tasks/assigned')
        .set('Authorization', `Bearer ${token}`)
        .expect('X-Content-Type-Options', 'nosniff');

      expect(res.body.some(task => task.title === 'Tournament Task')).toBe(true);
    });

    it('should exclude expired tasks', async () => {
      await TaskMd.create({
        taskId: new mongoose.Types.ObjectId(),
        title: 'Expired Task',
        xpReward: 100,
        category: 1,
        groups: ['global'],
        endTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });

      const res = await request(app)
        .get('/api/tasks/assigned')
        .set('Authorization', `Bearer ${token}`)
        .expect('X-Content-Type-Options', 'nosniff');

      expect(res.status).toBe(200);
      expect(res.body.some(task => task.title === 'Expired Task')).toBe(false);
    });
  });
});