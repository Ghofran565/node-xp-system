import mongoose from 'mongoose';
import catchAsync from '../Utils/catchAsync.js';
import HandleError from '../Utils/handleError.js';
import Tournament from '../Models/Tournament.js';
import Player from '../Models/Player.js';
import Task from '../Models/Task.js';
import AuditLog from '../Models/AuditLog.js';
import { cache } from '../Utils/cache.js';
import { sendEmailCode } from '../Utils/notifier.js';
import { logger } from '../Utils/logger.js';
import ApiFeatures from '../Utils/apiFeatures.js';

// Cache TTL for tournament data (1 hour in seconds)
const CACHE_TTL = 3600;

const checkEligibility = (player, tournament) => {
  const now = new Date();
  if (tournament.startTime > now || tournament.endTime < now) return false;
  return ['admin', 'moderator'].includes(player.role) || tournament.tournamentGroups.some(rankId => rankId.equals(player.rank));
};

export const getActiveTournaments = catchAsync(async (req, res, next) => {
  const { user } = req;

  const features = new ApiFeatures(Tournament, req.query, user.role)
    .filter()
    .sort()
    .limitFields()
    .paginate()
    .addManualFilters({
      startTime: { $lte: new Date() },
      endTime: { $gte: new Date() },
    })
    .populate('participants')
    .execute();
  const { data, totalCount, success } = await features;
  if (!success) return next(new HandleError('FAILED: Unable to retrieve tournaments. Contact support.', 500));

  if (totalCount === 0) return res.status(200).json({ status: 'SUCCESS', totalCount: 0, data: [] });

  const tournamentsWithTasks = await Promise.all(data.map(async (tournament) => {
    const tasks = await Task.find({ category: 0, tournamentId: tournament._id }).lean();
    return { ...tournament, tasks };
  }));

  res.status(200).json({ status: 'SUCCESS', totalCount, data: tournamentsWithTasks });
});

export const joinTournament = catchAsync(async (req, res, next) => {
  const { tournamentId } = req.params;
  const { user } = req;

  const tournament = await Tournament.findById(tournamentId).lean();
  if (!tournament) return next(new HandleError('Tournament not found.', 404));
  const player = await Player.findById(user.playerId).lean();
  if (!checkEligibility(player, tournament)) return next(new HandleError('Not eligible to join this tournament based on rank.', 403));
  if (tournament.participants.includes(user.playerId)) return next(new HandleError('Already joined.', 400));
  if (tournament.participants.length >= tournament.maxParticipants) return next(new HandleError('Tournament is at maximum capacity.', 403));

  const updatedTournament = await Tournament.findByIdAndUpdate(
    tournamentId,
    { $addToSet: { participants: user.playerId } },
    { new: true, runValidators: true }
  ).lean();
  if (!updatedTournament) return next(new HandleError('Failed to join tournament.', 500));

  await AuditLog.create({
    action: 'tournament_joined',
    playerId: user.playerId,
    details: { tournamentId },
    timestamp: new Date(),
  });
  logger.info(`Player ${user.playerId} joined tournament ${tournamentId}`);

  await cache.del(`tournaments:active`);
  await sendEmailCode(player.email, { playerId: user.playerId, purpose: 'tournament', content: `You’ve joined ${tournament.name}!` });
  res.status(200).json({ status: 'SUCCESS', totalCount: 1, data: updatedTournament });
});

export const completeTournamentTask = catchAsync(async (req, res, next) => {
  const { tournamentId } = req.params;
  const { taskId } = req.body;
  const { user } = req;

  const tournament = await Tournament.findById(tournamentId).lean();
  if (!tournament) return next(new HandleError('Tournament not found.', 404));
  if (!tournament.participants.includes(user.playerId)) return next(new HandleError('Not a participant.', 403));

  const task = await Task.findOne({ _id: taskId, tournamentId, category: 0 }).lean();
  if (!task) return next(new HandleError('Tournament task not found.', 404));

  const now = new Date();
  if (task.startTime > now || task.endTime < now) return next(new HandleError('Task is not available at this time.', 403));
  const progress = await PlayerTaskProgress.findOne({ playerId: user.playerId, taskId }).lean();
  if (progress?.completions >= 1) return next(new HandleError('Tournament task can only be completed once.', 403));

  const xp = task.xpReward; // Base XP for tournament tasks
  const updatedProgress = await PlayerTaskProgress.findOneAndUpdate(
    { playerId: user.playerId, taskId },
    { $set: { completions: 1, lastCompleted: now } },
    { upsert: true, new: true, runValidators: true }
  ).lean();
  const player = await Player.findByIdAndUpdate(
    user.playerId,
    { $inc: { totalXp: xp }, lastUpdated: now },
    { new: true, runValidators: true }
  ).lean();

  await updateRank(user.playerId);
  await AuditLog.create({
    action: 'tournament_task_completed',
    playerId: user.playerId,
    details: { taskId, tournamentId, xpAwarded: xp, newTotalXp: player.totalXp },
    timestamp: now,
  });
  logger.info(`Player ${user.playerId} completed tournament task ${taskId} for ${xp} XP`);

  await cache.del(`player:progress:${user.playerId}`);
  await cache.del(`player:rank:${user.playerId}`);
  await cache.del(`leaderboard:xp`);
  res.status(200).json({ status: 'SUCCESS', totalCount: 1, data: { taskId, xpAwarded: xp, newTotalXp: player.totalXp, rank: player.rank } });
});

// Admin Endpoints
export const createTournament = catchAsync(async (req, res, next) => {
  const { user } = req;
  if (user.role !== 'admin') return next(new HandleError('Access denied. Admin only.', 403));

  const { name, startTime, endTime, tournamentGroups, maxParticipants } = req.body;
  if (!name || !startTime || !endTime || !maxParticipants) return next(new HandleError('Name, startTime, endTime, and maxParticipants are required.', 400));
  if (new Date(startTime) >= new Date(endTime)) return next(new HandleError('End time must be after start time.', 400));
  if (tournamentGroups && !Array.isArray(tournamentGroups)) return next(new HandleError('Tournament groups must be an array.', 400));
  if (maxParticipants < 1) return next(new HandleError('Max participants must be at least 1.', 400));

  const tournament = await Tournament.create({
    name, startTime, endTime, tournamentGroups: tournamentGroups || [], maxParticipants,
  });
  await AuditLog.create({
    action: 'tournament_created',
    playerId: user.playerId,
    details: { tournamentId: tournament._id },
    timestamp: new Date(),
  });
  logger.info(`Tournament ${tournament._id} created by ${user.playerId}`);

  await cache.del('tournaments:active');
  await sendEmailCode(process.env.ALL_PLAYERS_EMAIL || '', { purpose: 'tournament', content: `A new tournament, ${tournament.name}, has started!` });
  res.status(201).json({ status: 'SUCCESS', totalCount: 1, data: tournament });
});

export const updateTournament = catchAsync(async (req, res, next) => {
  const { tournamentId } = req.params;
  const { user } = req;
  if (user.role !== 'admin') return next(new HandleError('Access denied. Admin only.', 403));

  const tournament = await Tournament.findById(tournamentId).lean();
  if (!tournament) return next(new HandleError('Tournament not found.', 404));
  const now = new Date();
  if (tournament.startTime <= now && req.body.startTime) return next(new HandleError('Cannot change start time after tournament has started.', 400));
  if (tournament.startTime <= now && req.body.endTime) return next(new HandleError('Cannot change end time after tournament has started.', 400));

  const updatedTournament = await Tournament.findByIdAndUpdate(tournamentId, req.body, { new: true, runValidators: true }).lean();
  if (!updatedTournament) return next(new HandleError('Failed to update tournament.', 500));

  await AuditLog.create({
    action: 'tournament_updated',
    playerId: user.playerId,
    details: { tournamentId },
    timestamp: new Date(),
  });
  logger.info(`Tournament ${tournamentId} updated by ${user.playerId}`);

  await cache.del(`tournament:${tournamentId}`);
  await cache.del('tournaments:active');
  res.status(200).json({ status: 'SUCCESS', totalCount: 1, data: updatedTournament });
});

export const deleteTournament = catchAsync(async (req, res, next) => {
  const { tournamentId } = req.params;
  const { user } = req;
  if (user.role !== 'admin') return next(new HandleError('Access denied. Admin only.', 403));

  const tournament = await Tournament.findByIdAndDelete(tournamentId).lean();
  if (!tournament) return next(new HandleError('Tournament not found.', 404));

  await Task.deleteMany({ tournamentId });
  await AuditLog.create({
    action: 'tournament_deleted',
    playerId: user.playerId,
    details: { tournamentId },
    timestamp: new Date(),
  });
  logger.info(`Tournament ${tournamentId} deleted by ${user.playerId}`);

  await cache.del(`tournament:${tournamentId}`);
  await cache.del('tournaments:active');
  res.status(200).json({ status: 'SUCCESS', totalCount: 1, message: 'Tournament deleted.' });
});