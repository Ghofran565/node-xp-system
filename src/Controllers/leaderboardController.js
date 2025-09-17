import mongoose from 'mongoose';
import catchAsync from '../Utils/catchAsync.js';
import HandleError from '../Utils/handleError.js';
import Player from '../Models/Player.js';
import Rank from '../Models/Rank.js';
import Tournament from '../Models/Tournament.js';
import Task from '../Models/Task.js'; // Included for potential future use
import AuditLog from '../Models/AuditLog.js';
import { cache } from '../Utils/cache.js';
import { sendEmailCode } from '../Utils/notifier.js';
import { logger } from '../Utils/logger.js';
import ApiFeatures from '../Utils/apiFeatures.js';

// Cache TTL for leaderboard data (10 minutes in seconds)
const CACHE_TTL = 600;

export const getLeaderboard = catchAsync(async (req, res, next) => {
  const cacheKey = 'leaderboard:xp';
  const cachedData = await cache.get(cacheKey);
  if (cachedData) return res.status(200).json({ status: 'SUCCESS', totalCount: JSON.parse(cachedData).length, data: JSON.parse(cachedData) });

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const features = new ApiFeatures(Player, req.query, req.user?.role || 'guest')
    .filter()
    .sort({ totalXp: -1 }) // Default sort by totalXp descending
    .limitFields()
    .paginate()
    .addManualFilters({
      lastUpdated: { $gte: thirtyDaysAgo },
      $or: [
        { 'groups': { $in: (await Tournament.find({ startTime: { $lte: new Date() }, endTime: { $gte: new Date() } }).distinct('tournamentGroups')) } },
        { role: { $in: ['admin', 'mod', 'owner'] } }
      ]
    }) // Filter for tournament participants or staff
    .populate('rank', 'rankName') // Populate rankName only
    .execute({ allowDiskUse: true });
  const { data, totalCount, success } = await features;
  if (!success) return next(new HandleError('FAILED: Unable to retrieve leaderboard. Contact support.', 500));

  if (totalCount === 0) return res.status(200).json({ status: 'SUCCESS', totalCount: 0, data: [] });

  const leaderboard = data.map(player => ({
    username: player.username,
    totalXp: player.totalXp,
    rank: player.rank?.rankName || 'Unranked',
    lastUpdated: player.lastUpdated,
    lastActive: player.lastUpdated, // Mapped to lastUpdated for now
    totalParticipants: totalCount, // Total filtered participants
  })).slice(0, 20); // Limit to top 20

  await cache.set(cacheKey, JSON.stringify(leaderboard), CACHE_TTL, { async: true }); // Asynchronous cache set
  res.status(200).json({ status: 'SUCCESS', totalCount: leaderboard.length, data: leaderboard });
});

export const getPlayerLeaderboardPosition = catchAsync(async (req, res, next) => {
  const { playerId } = req.params;

  const cacheKey = `leaderboard:position:${playerId}`;
  const cachedData = await cache.get(cacheKey);
  if (cachedData) return res.status(200).json({ status: 'SUCCESS', totalCount: 1, data: JSON.parse(cachedData) });

  const player = await Player.findById(playerId).lean();
  if (!player) return next(new HandleError('Player not found.', 404));

  const totalPlayers = await Player.countDocuments({ lastUpdated: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } });
  const position = await Player.countDocuments({ totalXp: { $gt: player.totalXp }, lastUpdated: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }) + 1;

  const data = {
    username: player.username,
    totalXp: player.totalXp,
    position,
    percentile: Math.round(((totalPlayers - position) / totalPlayers) * 100), // Rounded to nearest integer
    rank: (await Rank.findById(player.rank).lean())?.rankName || 'Unranked',
    lastUpdated: player.lastUpdated,
  };

  await cache.set(cacheKey, JSON.stringify(data), CACHE_TTL, { async: true }); // Asynchronous cache set
  res.status(200).json({ status: 'SUCCESS', totalCount: 1, data });
});

// Admin Endpoint
export const resetLeaderboardCache = catchAsync(async (req, res, next) => {
  const { user } = req;
  if (user.role !== 'admin') return next(new HandleError('Access denied. Admin only.', 403));

  await cache.del('leaderboard:xp');
  await cache.del('leaderboard:position:*');
  await cache.del('leaderboard:historical'); // Invalidate historical cache
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const activePlayers = await Player.aggregate([{ $match: { lastUpdated: { $gte: thirtyDaysAgo } } }]).exec();
  const leaderboard = await Player.find({ lastUpdated: { $gte: thirtyDaysAgo } })
    .sort({ totalXp: -1 })
    .limit(20)
    .lean();
  await cache.set('leaderboard:xp', JSON.stringify(leaderboard.map(p => ({
    username: p.username,
    totalXp: p.totalXp,
    rank: (await Rank.findById(p.rank).lean())?.rankName || 'Unranked',
    lastUpdated: p.lastUpdated,
  }))), CACHE_TTL, { async: true });
  await AuditLog.create({
    action: 'leaderboard_cache_reset',
    playerId: user.playerId,
    details: { activePlayersCount: activePlayers.length },
    timestamp: new Date(),
  });
  logger.info(`Leaderboard cache reset by ${user.playerId} with ${activePlayers.length} active players`);

  await sendEmailCode(process.env.ADMIN_EMAIL || '', { purpose: 'alert', content: 'Leaderboard cache has been reset.' });
  res.status(200).json({ status: 'SUCCESS', totalCount: 0, message: 'Leaderboard cache reset.' });
});

// New Endpoint
export const getHistoricalLeaderboard = catchAsync(async (req, res, next) => {
  const cacheKey = 'leaderboard:historical';
  const cachedData = await cache.get(cacheKey);
  if (cachedData) return res.status(200).json({ status: 'SUCCESS', totalCount: JSON.parse(cachedData).length, data: JSON.parse(cachedData) });

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const features = new ApiFeatures(Player, req.query, req.user?.role || 'guest')
    .filter()
    .sort({ totalXp: -1 })
    .limitFields()
    .paginate()
    .addManualFilters({
      lastUpdated: { $gte: thirtyDaysAgo },
      $or: [
        { 'groups': { $in: (await Tournament.find({ startTime: { $lte: new Date() }, endTime: { $gte: new Date() } }).distinct('tournamentGroups')) } },
        { role: { $in: ['admin', 'mod', 'owner'] } }
      ]
    }) // Filter for tournament participants or staff
    .populate('rank', 'rankName')
    .execute({ allowDiskUse: true });
  const { data, totalCount, success } = await features;
  if (!success) return next(new HandleError('FAILED: Unable to retrieve historical leaderboard. Contact support.', 500));

  if (totalCount === 0) return res.status(200).json({ status: 'SUCCESS', totalCount: 0, data: [] });

  const leaderboard = data.map(player => ({
    username: player.username,
    totalXp: player.totalXp,
    rank: player.rank?.rankName || 'Unranked',
    lastUpdated: player.lastUpdated,
  })).slice(0, 10); // Limit to top 10

  await cache.set(cacheKey, JSON.stringify(leaderboard), CACHE_TTL, { async: true }); // Asynchronous cache set
  res.status(200).json({ status: 'SUCCESS', totalCount: leaderboard.length, data: leaderboard });
});