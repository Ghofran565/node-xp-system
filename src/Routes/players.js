// routes/players.js
import express from 'express';
import { getPlayerProgress, getPlayerRank, getAllPlayers, updatePlayer } from '../controllers/playerController.js';
import auth from '../middlewares/auth.js';
import role from '../middlewares/role.js';
import verified from '../middlewares/verified.js';

const router = express.Router();

router.get('/:playerId/progress', auth, verified, getPlayerProgress);
router.get('/:playerId/rank', auth, verified, getPlayerRank);
router.get('/all', auth, role(['admin', 'moderator']), getAllPlayers);
router.put('/:playerId', auth, role(['admin', 'moderator']), updatePlayer);

export default router;