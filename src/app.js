import express from 'express';
import morgan from 'morgan';
import { fileURLToPath } from 'url';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server } from 'socket.io';
import catchError from './Utils/catchError.js';
import HandleError from './Utils/handleError.js';

// Custom imports
import leaderboardRouter from './routes/leaderboards.js';
import tournamentRouter from './routes/tournaments.js';
import taskRouter from './routes/tasks.js';
import authRouter from './routes/auth.js';
import playerRouter from './routes/players.js';
import healthRouter from './routes/health.js';
import Player from './models/playerMd.js'; // For XP updates
import { getUpdatedLeaderboard } from './controllers/playerController.js'; // Import leaderboard function

const __filename = fileURLToPath(import.meta.url);
export const __dirname = path.dirname(__filename);

const app = express();
export const httpServer = createServer(app);
export const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

app.use(express.static('public'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(morgan('dev'));
app.use(cors());
app.use(helmet());

app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'trusted-scripts.com'],
    },
  })
);

// Custom app uses
app.use('/api/leaderboards', leaderboardRouter);
app.use('/api/tournaments', tournamentRouter);
app.use('/api/tasks', taskRouter);
app.use('/api/auth', authRouter);
app.use('/api/players', playerRouter);
app.use('/api/health', healthRouter);

app.use(/(.*)/, (req, res, next) => {
  return next(new HandleError('Invalid route', 404));
});

// Global error handler
app.use(catchError);

// Socket.io event handlers
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });

  // Initial leaderboard data
  socket.emit('leaderboardUpdate', { message: 'Initial leaderboard data requested' });

  // Handle XP updates
  socket.on('xpUpdate', async (data) => {
    const { playerId, xp } = data;
    try {
      const player = await Player.findByIdAndUpdate(
        playerId,
        { $inc: { totalXp: xp }, lastUpdated: new Date() },
        { new: true, runValidators: true }
      );
      if (!player) {
        socket.emit('error', { message: 'Player not found' });
        return;
      }
      // Broadcast updated leaderboard
      const updatedLeaderboard = await getUpdatedLeaderboard();
      io.emit('leaderboardUpdate', updatedLeaderboard);
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });
});

export default app;