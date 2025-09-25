import express from 'express';
import auth from '../middlewares/auth.js';
import role from '../middlewares/role.js';
import verified from '../middlewares/verified.js';

const router = express.Router();

router.get('/all', auth, role(['admin', 'moderator']), async (req, res, next) => {
  try {
    const { getAllPlayers } = await import('../controllers/playerController.js');
    getAllPlayers(req, res);
  } catch (err) {
    next(err);
  }
});

router.get('/:playerId/progress', auth, verified, async (req, res, next) => {
  try {
    const { getPlayerProgress } = await import('../controllers/playerController.js');
    getPlayerProgress(req, res);
  } catch (err) {
    next(err);
  }
});

router.get('/:playerId/rank', auth, verified, async (req, res, next) => {
  try {
    const { getPlayerRank } = await import('../controllers/playerController.js');
    getPlayerRank(req, res);
  } catch (err) {
    next(err);
  }
});

router.put('/:playerId', auth, role(['admin', 'moderator']), async (req, res, next) => {
  try {
    const { updatePlayer } = await import('../controllers/playerController.js');
    updatePlayer(req, res);
  } catch (err) {
    next(err);
  }
});

export default router;