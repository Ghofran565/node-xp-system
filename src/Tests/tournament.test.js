import mongoose from 'mongoose';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { tournamentRouter } from '../Routes/tournaments.js';
import Tournament from '../Models/TournamentMd.js';
import Task from '../Models/taskMd.js';
import Player from '../Models/playerMd.js';
import { createClient } from 'redis';
import { Server } from 'socket.io';
import { validationResult } from 'express-validator';

const app = express();
app.use(express.json());
app.use('/api/tournaments', tournamentRouter);

describe('Tournament Endpoints', () => {
  let player, admin, tournament, token, adminToken;

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

    tournament = await Tournament.create({
      tournamentId: new mongoose.Types.ObjectId(),
      name: 'Test Tournament',
      startTime: new Date(),
      endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      participants: [],
      tournamentGroups: ['dedicated'],
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

  describe('GET /api/tournament', () => {
    it('should list active tournaments', async () => {
      const res = await request(app)
        .get('/api/tournament')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body[0]).toHaveProperty('name', 'Test Tournament');
    });
  });

  describe('POST /api/tournaments/:tournamentId/join', () => {
    it('should join tournament if eligible (tournament registration algorithm)', async () => {
      const res = await request(app)
        .post(`/api/tournaments/${tournament.tournamentId}/join`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Joined tournament successfully');

      const updatedTournament = await Tournament.findOne({ tournamentId: tournament.tournamentId });
      expect(updatedTournament.participants).toContainEqual(player.playerId);

      const updatedPlayer = await Player.findOne({ playerId: player.playerId });
      expect(updatedPlayer.groups).toContain(`tournament_${tournament.tournamentId.toString()}`);
    });

    it('should return 403 if not eligible', async () => {
      await Tournament.updateOne({ tournamentId: tournament.tournamentId }, { tournamentGroups: ['special'] });

      const res = await request(app)
        .post(`/api/tournaments/${tournament.tournamentId}/join`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('message', 'Not eligible for this tournament');
    });
  });

  describe('POST /api/tournaments/:tournamentId/tasks/complete', () => {
    it('should complete tournament task (no boosters)', async () => {
      const task = await Task.create({
        taskId: new mongoose.Types.ObjectId(),
        title: 'Tournament Task',
        xpReward: 200,
        maxCompletions: 1,
        category: 0,
        tournamentId: tournament.tournamentId,
        groups: ['dedicated'],
      });

      await Tournament.updateOne({ tournamentId: tournament.tournamentId }, { participants: [player.playerId] });

      const socket = Server();
      const redis = createClient();

      const res = await request(app)
        .post(`/api/tournaments/${tournament.tournamentId}/tasks/complete`)
        .set('Authorization', `Bearer ${token}`)
        .send({ taskId: task.taskId });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('xpAwarded', 200); // No boosters
      expect(socket.emit).toHaveBeenCalledWith('leaderboardUpdate', expect.any(Object));
      expect(redis.del).toHaveBeenCalledWith(`leaderboard:${tournament.tournamentId}`);
    });
  });

  describe('Admin Endpoints', () => {
    it('should create a tournament', async () => {
      const newTournament = {
        name: 'New Tournament',
        startTime: new Date(),
        endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        tournamentGroups: ['special'],
      };

      const res = await request(app)
        .post('/api/tournaments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newTournament);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('name', 'New Tournament');
    });

    it('should update a tournament', async () => {
      const res = await request(app)
        .put(`/api/tournaments/${tournament.tournamentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Tournament' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('name', 'Updated Tournament');
    });

    it('should delete a tournament', async () => {
      const redis = createClient();

      const res = await request(app)
        .delete(`/api/tournaments/${tournament.tournamentId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(204);
      expect(redis.del).toHaveBeenCalledWith(`leaderboard:${tournament.tournamentId}`);
    });
  });
});