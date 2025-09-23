// routes/tournaments.js
import express from 'express';
import { getActiveTournaments, joinTournament, completeTournamentTask, createTournament, updateTournament, deleteTournament } from '../controllers/tournamentController.js';
import auth from '../middlewares/auth.js';
import role from '../middlewares/role.js';
import verified from '../middlewares/verified.js';

const router = express.Router();

router.get('/', auth, getActiveTournaments);
router.post('/:tournamentId/join', auth, verified, joinTournament);
router.post('/:tournamentId/tasks/complete', auth, verified, completeTournamentTask);
router.post('/', auth, role(['admin']), createTournament);
router.put('/:tournamentId', auth, role(['admin']), updateTournament);
router.delete('/:tournamentId', auth, role(['admin']), deleteTournament);

export default router;