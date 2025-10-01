// Utilities/seed.js
import mongoose from 'mongoose';
import { config } from 'dotenv';
import bcrypt from 'bcrypt';
import path from 'path';
import Player from '../Models/PlayerMd.js';
import Rank from '../Models/RankMd.js';
import Group from '../Models/GroupMd.js';
import Tournament from '../Models/TournamentMd.js';
import Task from '../Models/TaskMd.js';
import PlayerTaskProgress from '../Models/PlayerTaskProgressMd.js';
import AuditLog from '../Models/AuditLogMd.js';

config({ path: path.resolve(process.cwd(), 'config.env') });

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.DATABASE_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    await Promise.all([
      Player.deleteMany({}),
      Rank.deleteMany({}),
      Group.deleteMany({}),
      Tournament.deleteMany({}),
      Task.deleteMany({}),
      PlayerTaskProgress.deleteMany({}),
      AuditLog.deleteMany({}),
    ]);

    const ranks = await Rank.insertMany([
      { rankId: new mongoose.Types.ObjectId(), rankName: 'bronze', minXp: 0, xpBooster: 1 },
      { rankId: new mongoose.Types.ObjectId(), rankName: 'silver', minXp: 1000, xpBooster: 1.5 },
      { rankId: new mongoose.Types.ObjectId(), rankName: 'gold', minXp: 2500, xpBooster: 2 },
      { rankId: new mongoose.Types.ObjectId(), rankName: 'diamond', minXp: 5000, xpBooster: 3 },
    ]);

    const groups = await Group.insertMany([
      { groupId: new mongoose.Types.ObjectId(), groupName: 'dedicated', xpBooster: 1.2 },
      { groupId: new mongoose.Types.ObjectId(), groupName: 'special', xpBooster: 1.5 },
    ]);

    const saltRounds = 10;
    const hashedPass1 = await bcrypt.hash('StrongPass123!', saltRounds);
    const hashedPass2 = await bcrypt.hash('AdminPass456!', saltRounds);
    const hashedPass3 = await bcrypt.hash('ModPass789!', saltRounds);

    const players = await Player.insertMany([
      {
        playerId: new mongoose.Types.ObjectId(),
        username: 'player1',
        email: 'player1@example.com',
        password: hashedPass1,
        verified: true,
        role: 'user',
        totalXp: 1500,
        groups: ['dedicated', 'tournament_123'],
        rank: 'silver',
        lastUpdated: new Date(),
      },
      {
        playerId: new mongoose.Types.ObjectId(),
        username: 'admin1',
        email: 'admin1@example.com',
        password: hashedPass2,
        verified: true,
        role: 'admin',
        totalXp: 6000,
        groups: ['special'],
        rank: 'diamond',
        lastUpdated: new Date(),
      },
      {
        playerId: new mongoose.Types.ObjectId(),
        username: 'mod1',
        email: 'mod1@example.com',
        password: hashedPass3,
        verified: true,
        role: 'moderator',
        totalXp: 3000,
        groups: ['dedicated'],
        rank: 'gold',
        lastUpdated: new Date(),
      },
      {
        playerId: new mongoose.Types.ObjectId(),
        username: 'unverified',
        email: 'unverified@example.com',
        password: hashedPass1,
        verified: false,
        role: 'user',
        totalXp: 0,
        groups: [],
        rank: 'bronze',
        lastUpdated: new Date(),
      },
    ]);

    const tournament = await Tournament.create({
      tournamentId: new mongoose.Types.ObjectId(),
      name: 'Test Tournament 2025',
      startTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      participants: [players[0].playerId, players[2].playerId],
      tournamentGroups: ['dedicated', 'special'],
    });

    const tasks = await Task.insertMany([
      {
        taskId: new mongoose.Types.ObjectId(),
        title: 'Tournament Task',
        xpReward: 200,
        maxCompletions: 1,
        cooldown: 0,
        category: 0,
        tournamentId: tournament.tournamentId,
        startTime: tournament.startTime,
        endTime: tournament.endTime,
        groups: ['dedicated'],
        playersBypass: [players[0].playerId],
      },
      {
        taskId: new mongoose.Types.ObjectId(),
        title: 'Daily Task',
        xpReward: 50,
        maxCompletions: 5,
        cooldown: 24 * 60 * 60 * 1000,
        category: 1,
        startTime: new Date(),
        endTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        groups: ['global'],
      },
      {
        taskId: new mongoose.Types.ObjectId(),
        title: 'Weekly Task',
        xpReward: 100,
        maxCompletions: 2,
        cooldown: 7 * 24 * 60 * 60 * 1000,
        category: 2,
        startTime: new Date(),
        endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        groups: ['special'],
      },
      {
        taskId: new mongoose.Types.ObjectId(),
        title: 'Yearly Task',
        xpReward: 1000,
        maxCompletions: 1,
        cooldown: 365 * 24 * 60 * 60 * 1000,
        category: 3,
        startTime: new Date(),
        endTime: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        groups: ['special'],
      },
      {
        taskId: new mongoose.Types.ObjectId(),
        title: 'Expired Task',
        xpReward: 100,
        maxCompletions: 1,
        cooldown: 0,
        category: 1,
        startTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
        groups: ['global'],
      },
      {
        taskId: new mongoose.Types.ObjectId(),
        title: 'Max Completions Task',
        xpReward: 50,
        maxCompletions: 2,
        cooldown: 3600000,
        category: 1,
        startTime: new Date(),
        endTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        groups: ['dedicated'],
      },
    ]);

    await PlayerTaskProgress.insertMany([
      {
        playerId: players[0].playerId,
        taskId: tasks[1].taskId,
        completions: 2,
        lastCompleted: new Date(Date.now() - 12 * 60 * 60 * 1000),
      },
      {
        playerId: players[2].playerId,
        taskId: tasks[0].taskId,
        completions: 1,
        lastCompleted: new Date(),
      },
      {
        playerId: players[0].playerId,
        taskId: tasks[5].taskId,
        completions: 2,
        lastCompleted: new Date(),
      },
    ]);

    await AuditLog.create({
      action: 'system_seed',
      playerId: players[1].playerId,
      details: { seededPlayers: 4, seededTournaments: 1, seededTasks: 6, seededProgress: 3 },
      timestamp: new Date(),
    });

    console.log('Database seeded successfully on', new Date().toLocaleString('en-US', { timeZone: 'Asia/Dubai' }));
  } catch (error) {
    console.error('Seeding failed:', error);
  } finally {
    await mongoose.connection.close();
  }
};

seedDatabase();