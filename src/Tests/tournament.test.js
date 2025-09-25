import mongoose from 'mongoose';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import tournamentRouter from '../Routes/tournaments.js';
import TournamentMd from '../Models/TournamentMd.js';
import PlayerMd from '../Models/PlayerMd.js';
import TaskMd from '../Models/TaskMd.js';
import GroupMd from '../Models/GroupMd.js';
import RankMd from '../Models/RankMd.js';
import { redis, io, helmetMiddleware, rateLimiter } from './setup.mjs';

const app = express();
app.use(helmetMiddleware);
app.use(express.json());
app.use(rateLimiter);
app.use('/api/tournaments', tournamentRouter);

describe('Tournament Endpoints', () => {
  let player, admin, tournament, task, silverRank, diamondRank, group;
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
      groupName: 'silver',
      xpBooster: 1.0,
    });

    tournament = await TournamentMd.create({
      tournamentId: new mongoose.Types.ObjectId(),
      name: 'Test Tournament',
      startTime: new Date(),
      endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      participants: [],
      tournamentGroups: [group._id, silverRank._id],
    });

    task = await TaskMd.create({
      taskId: new mongoose.Types.ObjectId(),
      title: 'Tournament Task',
      xpReward: 200,
      category: 0,
      tournamentId: tournament.tournamentId,
      groups: [group._id],
      startTime: new Date(),
      endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
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

  describe('GET /api/tournaments', () => {
    it('should list active tournaments', async () => {
      const res = await request(app)
        .get('/api/tournaments')
        .set('Authorization', `Bearer ${token}`)
        .expect('X-Content-Type-Options', 'nosniff');

      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body[0]).toHaveProperty('tournamentId', tournament.tournamentId.toString());
      expect(res.body[0]).toHaveProperty('name', 'Test Tournament');
    });

    it('should return 401 for unverified user', async () => {
      const unverifiedToken = jwt.sign(
        { playerId: player.playerId, role: 'user', rank: silverRank.rankName, groups: [group.groupName], verified: false },
        process.env.JWT_SECRET
      );

      const res = await request(app)
        .get('/api/tournaments')
        .set('Authorization', `Bearer ${unverifiedToken}`)
        .expect('X-Content-Type-Options', 'nosniff');

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('message', 'User not verified');
    });
  });

  describe('POST /api/tournaments/:tournamentId/join', () => {
    it('should allow eligible player to join tournament', async () => {
      const res = await request(app)
        .post(`/api/tournaments/${tournament.tournamentId}/join`)
        .set('Authorization', `Bearer ${token}`)
        .expect('X-Content-Type-Options', 'nosniff');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Successfully joined tournament');

      const updatedTournament = await TournamentMd.findOne({ tournamentId: tournament.tournamentId });
      expect(updatedTournament.participants).toContainEqual(player.playerId);

      const updatedPlayer = await PlayerMd.findOne({ playerId: player.playerId });
      expect(updatedPlayer.groups).toContain(`tournament_${tournament.tournamentId.toString()}`);
    });

    it('should return 403 if player is not eligible', async () => {
      await TournamentMd.updateOne(
        { tournamentId: tournament.tournamentId },
        { tournamentGroups: [diamondRank._id] }
      );

      const res = await request(app)
        .post(`/api/tournaments/${tournament.tournamentId}/join`)
        .set('Authorization', `Bearer ${token}`)
        .expect('X-Content-Type-Options', 'nosniff');

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('message', 'Not eligible to join this tournament');
    });

    it('should return 400 for invalid tournamentId', async () => {
      const res = await request(app)
        .post('/api/tournaments/invalid_id/join')
        .set('Authorization', `Bearer ${token}`)
        .expect('X-Content-Type-Options', 'nosniff');

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeInstanceOf(Array);
      expect(res.body.errors.some(err => err.msg === 'Invalid tournamentId')).toBe(true);
    });
  });

  describe('POST /api/tournaments/:tournamentId/tasks/complete', () => {
    it('should complete tournament task and award base XP', async () => {
      await TournamentMd.updateOne(
        { tournamentId: tournament.tournamentId },
        { participants: [player.playerId] }
      );

      const res = await request(app)
        .post(`/api/tournaments/${tournament.tournamentId}/tasks/complete`)
        .send({ taskId: task.taskId })
        .set('Authorization', `Bearer ${token}`)
        .expect('X-Content-Type-Options', 'nosniff');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('xpAwarded', 200); // Base XP, no boosters
      expect(res.body).toHaveProperty('newTotalXp', 1700); // 1500 + 200

      const updatedPlayer = await PlayerMd.findOne({ playerId: player.playerId });
      expect(updatedPlayer.totalXp).toBe(1700);
    });

    it('should return 403 if player is not a participant', async () => {
      const res = await request(app)
        .post(`/api/tournaments/${tournament.tournamentId}/tasks/complete`)
        .send({ taskId: task.taskId })
        .set('Authorization', `Bearer ${token}`)
        .expect('X-Content-Type-Options', 'nosniff');

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('message', 'Not a participant in this tournament');
    });
  });

  describe('Admin Endpoints', () => {
    describe('POST /api/tournaments', () => {
      it('should create a new tournament', async () => {
        const newTournament = {
          name: 'New Tournament',
          startTime: new Date(),
          endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          tournamentGroups: [group._id],
        };

        const res = await request(app)
          .post('/api/tournaments')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(newTournament)
          .expect('X-Content-Type-Options', 'nosniff');

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('name', 'New Tournament');
      });
    });

    describe('PUT /api/tournaments/:tournamentId', () => {
      it('should update a tournament', async () => {
        const res = await request(app)
          .put(`/api/tournaments/${tournament.tournamentId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ name: 'Updated Tournament' })
          .expect('X-Content-Type-Options', 'nosniff');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('name', 'Updated Tournament');
      });
    });

    describe('DELETE /api/tournaments/:tournamentId', () => {
      it('should delete a tournament', async () => {
        const res = await request(app)
          .delete(`/api/tournaments/${tournament.tournamentId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect('X-Content-Type-Options', 'nosniff');

        expect(res.status).toBe(204);
        expect(await TournamentMd.findOne({ tournamentId: tournament.tournamentId })).toBeNull();
      });
    });
  });
});