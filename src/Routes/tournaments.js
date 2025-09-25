import express from 'express';
import auth from '../middlewares/auth.js';
import role from '../middlewares/role.js';
import verified from '../middlewares/verified.js';

const router = express.Router();

router.get('/', auth, async (req, res, next) => {
  try {
    const { getActiveTournaments } = await import('../controllers/tournamentController.js');
    getActiveTournaments(req, res);
  } catch (err) {
    next(err);
  }
});

router.post('/:tournamentId/join', auth, verified, async (req, res, next) => {
  try {
    const { joinTournament } = await import('../controllers/tournamentController.js');
    joinTournament(req, res);
  } catch (err) {
    next(err);
  }
});

router.post('/:tournamentId/tasks/complete', auth, verified, async (req, res, next) => {
  try {
    const { completeTournamentTask } = await import('../controllers/tournamentController.js');
    completeTournamentTask(req, res);
  } catch (err) {
    next(err);
  }
});

router.post('/', auth, role(['admin']), async (req, res, next) => {
  try {
    const { createTournament } = await import('../controllers/tournamentController.js');
    createTournament(req, res);
  } catch (err) {
    next(err);
  }
});

router.put('/:tournamentId', auth, role(['admin']), async (req, res, next) => {
  try {
    const { updateTournament } = await import('../controllers/tournamentController.js');
    updateTournament(req, res);
  } catch (err) {
    next(err);
  }
});

router.delete('/:tournamentId', auth, role(['admin']), async (req, res, next) => {
  try {
    const { deleteTournament } = await import('../controllers/tournamentController.js');
    deleteTournament(req, res);
  } catch (err) {
    next(err);
  }
});

export default router;