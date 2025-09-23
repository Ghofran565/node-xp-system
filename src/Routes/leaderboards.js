// routes/leaderboards.js
import express from 'express';
import { getLeaderboard, getPlayerLeaderboardPosition, resetLeaderboardCache, getHistoricalLeaderboard } from '../controllers/leaderboardController.js';
import auth from '../middlewares/auth.js';
import role from '../middlewares/role.js';

const router = express.Router();

router.get('/', auth, getLeaderboard);
router.get('/players/:playerId', auth, getPlayerLeaderboardPosition);
router.post('/reset', auth, role(['admin']), resetLeaderboardCache);
router.get('/historical', auth, getHistoricalLeaderboard);

export default router;