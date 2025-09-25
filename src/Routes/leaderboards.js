import express from 'express';
import auth from '../middlewares/auth.js';
import role from '../middlewares/role.js';

const router = express.Router();

router.get('/', auth, async (req, res, next) => {
  try {
    const { getLeaderboard } = await import('../controllers/leaderboardController.js');
    getLeaderboard(req, res);
  } catch (err) {
    next(err);
  }
});

router.get('/players/:playerId', auth, async (req, res, next) => {
  try {
    const { getPlayerLeaderboardPosition } = await import('../controllers/leaderboardController.js');
    getPlayerLeaderboardPosition(req, res);
  } catch (err) {
    next(err);
  }
});

router.post('/reset', auth, role(['admin']), async (req, res, next) => {
  try {
    const { resetLeaderboardCache } = await import('../controllers/leaderboardController.js');
    resetLeaderboardCache(req, res);
  } catch (err) {
    next(err);
  }
});

router.get('/historical', auth, async (req, res, next) => {
  try {
    const { getHistoricalLeaderboard } = await import('../controllers/leaderboardController.js');
    getHistoricalLeaderboard(req, res);
  } catch (err) {
    next(err);
  }
});

export default router;