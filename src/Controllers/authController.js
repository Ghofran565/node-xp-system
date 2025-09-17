import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import catchAsync from '../Utils/catchAsync.js';
import HandleError from '../Utils/handleError.js';
import { sendEmailCode } from '../Utils/notifier.js';
import Player from '../Models/Player.js';
import ApiFeatures from '../Utils/apiFeatures.js';

// Validation regex
const emailRegex = /^(?!.*[@ \t\r\n]{2})[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const verificationCodeRegex = /^\d{5}$/;
const passwordRegex = /^(?=.*[a-z])(?=.*\d).{8,}$/;

const generateToken = (player, additionalPayload = {}) => {
  const payload = {
    playerId: player._id.toString(),
    email: player.email,
    role: player.role || 'user',
    rank: player.rank || null,
    groups: player.groups || [],
    verified: player.verified || false,
    ...additionalPayload,
  };
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '120h' });
};

export const register = catchAsync(async (req, res, next) => {
  const { email, password, username } = req.body;

  if (!emailRegex.test(email)) return next(new HandleError('Invalid email format.', 400));
  if (!passwordRegex.test(password)) return next(new HandleError('Invalid password format.', 400));
  if (!username || username.trim().length < 3) return next(new HandleError('Invalid username.', 400));

  const features = new ApiFeatures(Player, { email }, req.user?.role || 'guest')
    .filter()
    .limitFields()
    .execute();
  const { data: [existingPlayer], totalCount } = await features;
  if (totalCount > 0) return next(new HandleError('Email already registered.', 409));

  const hashedPassword = await bcryptjs.hash(password, 12);
  const newPlayer = await Player.create({
    email: email.toLowerCase(),
    password: hashedPassword,
    username: username.trim(),
    verified: false,
    lastUpdated: new Date(),
  });

  await sendEmailCode(email, { playerId: newPlayer._id, purpose: 'verify' });

  const token = generateToken(newPlayer);
  res.status(201).json({ status: 'SUCCESS', totalCount: 1, data: { token, player: { username: newPlayer.username, email: newPlayer.email } } });
});

export const verifyEmail = catchAsync(async (req, res, next) => {
  const { email, code } = req.body;

  if (!emailRegex.test(email)) return next(new HandleError('Invalid email format.', 400));
  if (!verificationCodeRegex.test(code)) return next(new HandleError('Invalid verification code.', 400));

  const verificationResult = await import('../Utils/notifier.js').then(m => m.verifyEmailCode(email, code));
  if (!verificationResult.authorized) return next(new HandleError(verificationResult.message, 401));

  const player = await Player.findOneAndUpdate(
    { email, verified: false },
    { verified: true, lastUpdated: new Date() },
    { new: true, runValidators: true }
  ).lean();
  if (!player) return next(new HandleError('User not found or already verified.', 404));

  const token = generateToken(player);
  res.status(200).json({ status: 'SUCCESS', totalCount: 1, data: { token, player: { username: player.username, email: player.email, role: player.role, rank: player.rank, groups: player.groups } } });
});

export const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  if (!emailRegex.test(email)) return next(new HandleError('Invalid email format.', 400));
  if (!passwordRegex.test(password)) return next(new HandleError('Invalid password format.', 400));

  const features = new ApiFeatures(Player, { email }, req.user?.role || 'guest')
    .filter()
    .limitFields()
    .execute();
  const { data: [player], totalCount } = await features;
  if (totalCount === 0 || !bcryptjs.compareSync(password, player.password)) return next(new HandleError('Invalid email or password.', 401));

  if (!player.verified) return next(new HandleError('Please verify your email first.', 403));

  const token = generateToken(player);
  res.status(200).json({ status: 'SUCCESS', totalCount: 1, data: { token, player: { username: player.username, email: player.email, role: player.role, rank: player.rank, groups: player.groups, verified: player.verified } } });
});

export const forgotPassword = catchAsync(async (req, res, next) => {
  const { email } = req.body;

  if (!emailRegex.test(email)) return next(new HandleError('Invalid email format.', 400));

  const features = new ApiFeatures(Player, { email }, req.user?.role || 'guest')
    .filter()
    .limitFields()
    .execute();
  const { data: [player], totalCount } = await features;
  if (totalCount === 0) return next(new HandleError('User not found.', 404));

  await sendEmailCode(email, { playerId: player._id, purpose: 'reset' });
  res.status(200).json({ status: 'SUCCESS', totalCount: 1, message: 'Password reset code sent.' });
});

export const resetPassword = catchAsync(async (req, res, next) => {
  const { email, code, password } = req.body;

  if (!emailRegex.test(email)) return next(new HandleError('Invalid email format.', 400));
  if (!verificationCodeRegex.test(code)) return next(new HandleError('Invalid verification code.', 400));
  if (!passwordRegex.test(password)) return next(new HandleError('Invalid password format.', 400));

  const verificationResult = await import('../Utils/notifier.js').then(m => m.verifyEmailCode(email, code, 'reset'));
  if (!verificationResult.authorized) return next(new HandleError(verificationResult.message, 401));

  const hashedPassword = await bcryptjs.hash(password, 12);
  const player = await Player.findOneAndUpdate(
    { email },
    { password: hashedPassword, lastUpdated: new Date() },
    { new: true, runValidators: true }
  ).lean();
  if (!player) return next(new HandleError('User not found.', 404));

  const token = generateToken(player);
  res.status(200).json({ status: 'SUCCESS', totalCount: 1, data: { token, player: { username: player.username, email: player.email, role: player.role } } });
});