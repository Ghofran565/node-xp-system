import mongoose from 'mongoose';
import catchAsync from '../Utils/catchAsync.js';
import HandleError from '../Utils/handleError.js';
import Task from '../Models/Task.js';
import Player from '../Models/Player.js';
import PlayerTaskProgress from '../Models/PlayerTaskProgress.js';
import Tournament from '../Models/Tournament.js';
import Group from '../Models/Group.js';
import Rank from '../Models/Rank.js';
import AuditLog from '../Models/AuditLog.js';
import { cache } from '../Utils/cache.js';
import { sendEmailCode } from '../Utils/notifier.js';
import { logger } from '../Utils/logger.js';
import ApiFeatures from '../Utils/apiFeatures.js';

// Cache TTL for task data (30 minutes in seconds)
const CACHE_TTL = 1800;

const calculateXP = async (task, player) => {
  const now = new Date();
  if (!player.verified) throw new HandleError('Player must be verified.', 403);

  let xp = task.xpReward;
  if (task.category !== 0) { // Not tournament
    const groupBoosters = (await Group.find({ groupName: { $in: player.groups } }).lean())
      .reduce((sum, g) => sum + (g.xpBooster || 0), 0);
    xp += xp * groupBoosters; // Group boosters always apply
  }

  const activeTournament = await Tournament.findOne({
    participants: player._id,
    startTime: { $lte: now },
    endTime: { $gte: now },
  }).lean();
  if (activeTournament) {
    const rankBooster = (await Rank.findById(player.rank).lean())?.xpBooster || 1;
    xp += (task.category === 0 ? 0 : xp * (groupBoosters + rankBooster)); // Sum with tournament boosters for non-tournament tasks
  }

  return xp;
};

export const getAssignedTasks = catchAsync(async (req, res, next) => {
  const { user } = req;

  const features = new ApiFeatures(Task, req.query, user.role)
    .filter()
    .sort()
    .limitFields()
    .paginate()
    .addManualFilters({
      $or: [
        { groups: { $in: ['global', ...(user.groups || [])] } },
        { playersBypass: user.playerId },
      ],
      startTime: { $lte: new Date() },
      endTime: { $gte: new Date() },
    })
    .populate('tournamentId')
    .execute();
  const { data, totalCount, success } = await features;
  if (!success) return next(new HandleError('FAILED: Unable to retrieve tasks. Contact support.', 500));

  const tournamentTasks = await Task.find({ category: 0, tournamentId: { $in: (await Tournament.find({ participants: user.playerId }).select('_id')).map(t => t._id) } })
    .lean();
  const allTasks = [...data, ...tournamentTasks].filter(t => t.startTime <= new Date() && t.endTime >= new Date());

  if (allTasks.length === 0) return res.status(200).json({ status: 'SUCCESS', totalCount: 0, data: [] });

  const tasksWithProgress = await Promise.all(allTasks.map(async (task) => {
    const progress = await PlayerTaskProgress.findOne({ playerId: user.playerId, taskId: task._id }).lean();
    return { ...task, completions: progress?.completions || 0, lastCompleted: progress?.lastCompleted };
  }));

  res.status(200).json({ status: 'SUCCESS', totalCount: tasksWithProgress.length, data: tasksWithProgress });
});

export const getTaskDetails = catchAsync(async (req, res, next) => {
  const { taskId } = req.params;
  const { user } = req;

  const features = new ApiFeatures(Task, { _id: taskId }, user.role)
    .filter()
    .limitFields()
    .populate('tournamentId')
    .execute();
  const { data: [task], totalCount, success } = await features;
  if (!success) return next(new HandleError('FAILED: Unable to retrieve task. Contact support.', 500));
  if (totalCount === 0) return next(new HandleError('Task not found.', 404));

  const eligible = task.groups.some(g => ['global', ...(user.groups || [])].includes(g)) ||
    task.playersBypass.includes(user.playerId) ||
    (task.category === 0 && (await Tournament.findOne({ _id: task.tournamentId, participants: user.playerId }).lean()));
  if (!eligible) return next(new HandleError('Access denied. Task not eligible.', 403));

  const progress = await PlayerTaskProgress.findOne({ playerId: user.playerId, taskId }).lean();
  res.status(200).json({ status: 'SUCCESS', totalCount: 1, data: { ...task, completions: progress?.completions || 0, lastCompleted: progress?.lastCompleted } });
});

export const completeTask = catchAsync(async (req, res, next) => {
  const { taskId } = req.params;
  const { user } = req;

  const task = await Task.findById(taskId).lean();
  if (!task) return next(new HandleError('Task not found.', 404));

  const now = new Date();
  if (task.startTime > now || task.endTime < now) return next(new HandleError('Task is not available at this time.', 403));
  if (task.category === 0 && task.maxCompletions > 1) {
    return next(new HandleError('Tournament tasks can only be completed once.', 400));
  }
  if (task.maxCompletions > 0) {
    const progress = await PlayerTaskProgress.findOne({ playerId: user.playerId, taskId }).lean();
    if (progress?.completions >= task.maxCompletions) return next(new HandleError('Task completion limit reached.', 403));
  }
  if (task.cooldown > 0 && task.category !== 0) { // No cooldown for tournament tasks
    const progress = await PlayerTaskProgress.findOne({ playerId: user.playerId, taskId }).lean();
    if (progress?.lastCompleted && (now - progress.lastCompleted < task.cooldown * 1000)) {
      return next(new HandleError('Task is on cooldown.', 403));
    }
  }

  const player = await Player.findById(user.playerId).lean();
  const xp = await calculateXP(task, player);
  const progress = await PlayerTaskProgress.findOneAndUpdate(
    { playerId: user.playerId, taskId },
    { $inc: { completions: 1 }, lastCompleted: now },
    { upsert: true, new: true, runValidators: true }
  ).lean();
  const updatedPlayer = await Player.findByIdAndUpdate(
    user.playerId,
    { $inc: { totalXp: xp }, lastUpdated: now },
    { new: true, runValidators: true }
  ).lean();

  await updateRank(user.playerId);
  await AuditLog.create({
    action: 'task_completed',
    playerId: user.playerId,
    details: { taskId, xpAwarded: xp, newTotalXp: updatedPlayer.totalXp },
    timestamp: now,
  });
  logger.info(`Player ${user.playerId} completed task ${taskId} for ${xp} XP`);

  await cache.del(`player:progress:${user.playerId}`);
  await cache.del(`player:rank:${user.playerId}`);
  await cache.del(`leaderboard:xp`);
  res.status(200).json({ status: 'SUCCESS', totalCount: 1, data: { taskId, xpAwarded: xp, newTotalXp: updatedPlayer.totalXp, rank: updatedPlayer.rank } });
});

// Admin/Moderator Endpoints
export const getAllTasks = catchAsync(async (req, res, next) => {
  const { user } = req;
  if (user.role !== 'admin' && user.role !== 'moderator') return next(new HandleError('Access denied. Admin/moderator only.', 403));

  const features = new ApiFeatures(Task, req.query, user.role)
    .filter()
    .sort()
    .limitFields()
    .paginate()
    .populate('tournamentId')
    .execute();
  const { data, totalCount, success } = await features;
  if (!success) return next(new HandleError('FAILED: Unable to retrieve tasks. Contact support.', 500));

  if (totalCount === 0) return res.status(200).json({ status: 'SUCCESS', totalCount: 0, data: [] });

  res.status(200).json({ status: 'SUCCESS', totalCount, data });
});

export const createTask = catchAsync(async (req, res, next) => {
  const { user } = req;
  if (user.role !== 'admin' && user.role !== 'moderator') return next(new HandleError('Access denied. Admin/moderator only.', 403));

  const { title, xpReward, maxCompletions, cooldown, groups, playersBypass, category, tournamentId, startTime, endTime } = req.body;
  if (xpReward <= 0) return next(new HandleError('XP reward must be positive.', 400));
  if (maxCompletions < 0) return next(new HandleError('Max completions cannot be negative.', 400));
  if (cooldown < 0) return next(new HandleError('Cooldown cannot be negative.', 400));
  if (category === null || ![0, 1, 2].includes(category)) return next(new HandleError('Invalid category. Use 0 (tournament), 1 (daily), or 2 (weekly).', 400));
  if (groups && !Array.isArray(groups)) return next(new HandleError('Groups must be an array.', 400));
  if (playersBypass && !Array.isArray(playersBypass)) return next(new HandleError('Players bypass must be an array.', 400));
  if (tournamentId && !mongoose.Types.ObjectId.isValid(tournamentId)) return next(new HandleError('Invalid tournamentId.', 400));
  if (tournamentId) {
    const tournament = await Tournament.findById(tournamentId).lean();
    if (!tournament) return next(new HandleError('Tournament not found.', 404));
    if (category !== 0) return next(new HandleError('Only tournament category (0) can be linked to a tournament.', 400));
  }
  if (startTime && endTime && new Date(startTime) >= new Date(endTime)) return next(new HandleError('End time must be after start time.', 400));

  const task = await Task.create({
    title, xpReward, maxCompletions, cooldown, groups, playersBypass, category, tournamentId, startTime, endTime,
  });
  await AuditLog.create({
    action: 'task_created',
    playerId: user.playerId,
    details: { taskId: task._id },
    timestamp: new Date(),
  });
  logger.info(`Task ${task._id} created by ${user.playerId}`);

  await cache.del('tasks:assigned:*');
  res.status(201).json({ status: 'SUCCESS', totalCount: 1, data: task });
});

export const updateTask = catchAsync(async (req, res, next) => {
  const { taskId } = req.params;
  const { user } = req;
  if (user.role !== 'admin' && user.role !== 'moderator') return next(new HandleError('Access denied. Admin/moderator only.', 403));

  const task = await Task.findByIdAndUpdate(taskId, req.body, { new: true, runValidators: true }).lean();
  if (!task) return next(new HandleError('Task not found.', 404));

  await AuditLog.create({
    action: 'task_updated',
    playerId: user.playerId,
    details: { taskId },
    timestamp: new Date(),
  });
  logger.info(`Task ${taskId} updated by ${user.playerId}`);

  await cache.del(`task:${taskId}`);
  await cache.del('tasks:assigned:*');
  res.status(200).json({ status: 'SUCCESS', totalCount: 1, data: task });
});

export const deleteTask = catchAsync(async (req, res, next) => {
  const { taskId } = req.params;
  const { user } = req;
  if (user.role !== 'admin' && user.role !== 'moderator') return next(new HandleError('Access denied. Admin/moderator only.', 403));

  const task = await Task.findByIdAndDelete(taskId).lean();
  if (!task) return next(new HandleError('Task not found.', 404));

  await AuditLog.create({
    action: 'task_deleted',
    playerId: user.playerId,
    details: { taskId },
    timestamp: new Date(),
  });
  logger.info(`Task ${taskId} deleted by ${user.playerId}`);

  await cache.del(`task:${taskId}`);
  await cache.del('tasks:assigned:*');
  res.status(200).json({ status: 'SUCCESS', totalCount: 1, message: 'Task deleted.' });
});