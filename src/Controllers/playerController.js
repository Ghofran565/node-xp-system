// controllers/playerController.js
import mongoose from 'mongoose';
import catchAsync from '../Utils/catchAsync.js';
import HandleError from '../Utils/handleError.js';
import Player from '../Models/playerMd.js';
import PlayerTaskProgress from '../Models/PlayerTaskProgressMd.js';
import Rank from '../Models/RankMd.js';
import AuditLog from '../Models/AuditLogMd.js';
import { cache } from '../utils/cache.js';
import { sendEmailCode, sendCustomEmail } from '../Utils/notifier.js';
import { logger } from '../Utils/logger.js';
import ApiFeatures from '../Utils/apiFeatures.js';
import { io } from '../app.js';

// Cache TTL for rank data (1 hour in seconds)
const CACHE_TTL = 3600;

const updateRank = async (playerId) => {
  const player = await Player.findById(playerId).lean();
  if (!player) throw new HandleError('Player not found.', 404);

  const ranks = await Rank.find().sort({ minXp: 1 }).lean();
  const currentRank = ranks.find(r => player.totalXp >= r.minXp) || ranks[0];
  if (!mongoose.Types.ObjectId.isValid(currentRank._id)) throw new HandleError('Invalid rank reference.', 500);

  if (player.rank.toString() !== currentRank._id.toString()) {
    const updatedPlayer = await Player.findByIdAndUpdate(
      playerId,
      { rank: currentRank._id, lastUpdated: new Date() },
      { new: true, runValidators: true }
    ).lean();

    await sendEmailCode(player.email, { playerId, purpose: 'rank', content: `You've advanced to ${currentRank.rankName} with an XP booster of ${currentRank.xpBooster}x!` });
    await AuditLog.create({
      action: 'rank_updated',
      playerId,
      details: { newRank: currentRank._id, totalXp: player.totalXp },
      timestamp: new Date(),
    });
    logger.info(`Rank updated for player ${playerId} to ${currentRank.rankName}`);

    // Emit rank update
    io.emit('rankUpdate', { playerId, rankName: currentRank.rankName, totalXp: player.totalXp });

    await cache.del(`player:rank:${playerId}`);
    await cache.del(`leaderboard:xp`);
    const xpPerHour = player.totalXp / ((new Date() - player.lastUpdated) / 3600000);
    const topPlayers = await Player.find().sort({ totalXp: -1 }).limit(10).lean();
    const top10Avg = topPlayers.slice(0, Math.ceil(topPlayers.length * 0.1)).reduce((sum, p) => sum + p.totalXp, 0) / 10;
    if (xpPerHour > 5 * top10Avg) {
      await sendEmailCode(process.env.ADMIN_EMAIL, { playerId, purpose: 'alert', content: `Anomaly detected: Player ${playerId} gained ${xpPerHour} XP/hour.` });
      await AuditLog.create({
        action: 'anomaly_detected',
        playerId,
        details: { xpPerHour, threshold: 5 * top10Avg },
        timestamp: new Date(),
      });
    }
  }
  return currentRank;
};

export const getPlayerProgress = catchAsync(async (req, res, next) => {
  const { playerId } = req.params;
  const { user } = req;

  if (playerId !== user.playerId) return next(new HandleError('Access denied. View only your own progress.', 403));

  const player = await Player.findById(playerId).lean();
  if (!player) return next(new HandleError('Player not found.', 404));

  try {
    const progress = await PlayerTaskProgress.find({ playerId }).lean();
    const totalCompletions = progress.reduce((sum, p) => sum + (p.completions || 0), 0);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const historicalProgress = progress.filter(p => p.lastCompleted > thirtyDaysAgo);
    const taskIds = historicalProgress.map(p => p.taskId);
    const tasks = await import('../Models/Task.js').then(mod => mod.default || mod.Task || mod); // dynamic import to avoid missing import
    const taskDocs = await tasks.find({ _id: { $in: taskIds } }).lean();
    const taskXpMap = {};
    taskDocs.forEach(t => { taskXpMap[t._id.toString()] = t.xpReward || 0; });

    const xpEarnedLast30Days = historicalProgress.reduce((sum, p) => {
      const xpReward = taskXpMap[p.taskId?.toString()] || 0;
      return sum + (p.completions * xpReward);
    }, 0);

    const data = {
      username: player.username,
      totalXp: player.totalXp,
      rank: player.rank,
      groups: player.groups,
      totalCompletions,
      xpEarnedLast30Days,
      historicalCompletions: historicalProgress.length,
      lastUpdated: player.lastUpdated,
    };

    res.status(200).json({ status: 'SUCCESS', totalCount: 1, data });
  } catch (error) {
    return next(new HandleError('FAILED: Database error retrieving progress. Contact support if this persists.', 500));
  }
});

export const getPlayerRank = catchAsync(async (req, res, next) => {
  const { playerId } = req.params;
  const { user } = req;

  if (playerId !== user.playerId) return next(new HandleError('Access denied. View only your own rank.', 403));

  const cacheKey = `player:rank:${playerId}`;
  const cachedData = await cache.get(cacheKey);
  if (cachedData) return res.status(200).json({ status: 'SUCCESS', totalCount: 1, data: JSON.parse(cachedData) });

  const player = await Player.findById(playerId).lean();
  if (!player) return next(new HandleError('Player not found.', 404));

  const currentRank = await Rank.findById(player.rank).lean();
  if (!currentRank) return next(new HandleError('Invalid rank reference.', 404));

  const ranks = await Rank.find().sort({ minXp: 1 }).lean();
  const nextRank = ranks.find(r => r.minXp > player.totalXp) || null;
  const xpToNextRank = nextRank ? nextRank.minXp - player.totalXp : 0;

  const data = {
    username: player.username,
    rankId: currentRank._id,
    rankName: currentRank.rankName,
    xpBooster: currentRank.xpBooster,
    totalXp: player.totalXp,
    xpToNextRank,
    lastUpdated: player.lastUpdated,
  };

  await cache.set(cacheKey, JSON.stringify(data), CACHE_TTL, { async: true });
  res.status(200).json({ status: 'SUCCESS', totalCount: 1, data });
});

export const getAllPlayers = catchAsync(async (req, res, next) => {
  const { user } = req;
  if (user.role !== 'admin' && user.role !== 'moderator') return next(new HandleError('Access denied. Admin/moderator only.', 403));

  const features = new ApiFeatures(Player, req.query, user.role)
    .filter()
    .sort()
    .limitFields()
    .paginate()
    .execute();
  const { data, totalCount, success } = await features;
  if (!success) return next(new HandleError('FAILED: Unable to retrieve players. Contact support.', 500));

  if (totalCount === 0) return res.status(200).json({ status: 'SUCCESS', totalCount: 0, data: [] });

  res.status(200).json({ status: 'SUCCESS', totalCount, data: data.map(p => ({ ...p, password: undefined, lastActive: p.lastUpdated })) });
});

export const updatePlayer = catchAsync(async (req, res, next) => {
  const { playerId } = req.params;
  const { user } = req;
  const { role, groups, rank, totalXp } = req.body;

  if (user.role !== 'admin' && user.role !== 'moderator') return next(new HandleError('Access denied. Admin/moderator only.', 403));
  const player = await Player.findById(playerId).lean();
  if (!player.verified) return next(new HandleError('Player must be verified.', 403));

  const validRoles = ['user', 'admin', 'moderator'];
  if (role && !validRoles.includes(role)) return next(new HandleError('Invalid role.', 400));

  if (rank && !mongoose.Types.ObjectId.isValid(rank)) return next(new HandleError('Invalid rank ObjectId.', 400));
  const validRank = rank ? await Rank.findById(rank).lean() : null;
  if (rank && !validRank) return next(new HandleError('Rank does not exist.', 400));

  if (groups && (!Array.isArray(groups) || !groups.every(g => typeof g === 'string'))) return next(new HandleError('Invalid groups format.', 400));

  const updateData = { verified: true };
  if (role) updateData.role = role;
  if (groups) updateData.groups = groups;
  if (rank) updateData.rank = rank;
  if (totalXp !== undefined && (user.role === 'admin' || user.role === 'moderator')) {
    updateData.totalXp = Number(totalXp); // Allow decrement for mods/admins
    await updateRank(playerId);
  }
  if (!Object.keys(updateData).length) return next(new HandleError('No updates provided.', 400));

  updateData.lastUpdated = new Date();

  const updatedPlayer = await Player.findByIdAndUpdate(playerId, updateData, { new: true, runValidators: true }).lean();
  if (!updatedPlayer) return next(new HandleError('Player not found.', 404));

  await AuditLog.create({
    action: 'player_updated',
    playerId,
    details: { role, groups, rank, totalXp },
    timestamp: new Date(),
  });
  logger.info(`Player ${playerId} updated by ${user.playerId}`);

  await cache.del(`player:rank:${playerId}`, { async: true });
  // Invalidate leaderboard:xp only if XP changed significantly (e.g., >10%)
  if (totalXp !== undefined && Math.abs(totalXp - player.totalXp) > player.totalXp * 0.1) {
    await cache.del(`leaderboard:xp`, { async: true });
  }
  await sendCustomEmail(updatedPlayer.email, 'Profile Updated', 'There was an update in your account.');

  // Emit leaderboard and rank updates
  const updatedLeaderboard = await getUpdatedLeaderboard();
  io.emit('leaderboardUpdate', updatedLeaderboard);
  io.emit('rankUpdate', { playerId, rankName: (await Rank.findById(updatedPlayer.rank).lean()).rankName, totalXp: updatedPlayer.totalXp });

  res.status(200).json({ status: 'SUCCESS', totalCount: 1, data: updatedPlayer });
});

// Export for use in app.js
export async function getUpdatedLeaderboard() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const features = new ApiFeatures(Player, {}, 'guest')
    .sort({ totalXp: -1 })
    .limitFields()
    .addManualFilters({ lastUpdated: { $gte: thirtyDaysAgo } })
    .populate('rank', 'rankName')
    .execute({ allowDiskUse: true });
  const { data } = await features;
  return data.map(player => ({
    username: player.username,
    totalXp: player.totalXp,
    rank: player.rank?.rankName || 'Unranked',
    lastUpdated: player.lastUpdated,
  })).slice(0, 20);
}