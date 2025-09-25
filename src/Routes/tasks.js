import express from 'express';
import auth from '../middlewares/auth.js';
import role from '../middlewares/role.js';
import verified from '../middlewares/verified.js';

const router = express.Router();

router.get('/assigned', auth, verified, async (req, res, next) => {
  try {
    const { getAssignedTasks } = await import('../controllers/taskController.js');
    getAssignedTasks(req, res);
  } catch (err) {
    next(err);
  }
});

router.get('/:taskId', auth, verified, async (req, res, next) => {
  try {
    const { getTaskDetails } = await import('../controllers/taskController.js');
    getTaskDetails(req, res);
  } catch (err) {
    next(err);
  }
});

router.post('/:taskId/complete', auth, verified, async (req, res, next) => {
  try {
    const { completeTask } = await import('../controllers/taskController.js');
    completeTask(req, res);
  } catch (err) {
    next(err);
  }
});

router.get('/all', auth, role(['admin', 'moderator']), async (req, res, next) => {
  try {
    const { getAllTasks } = await import('../controllers/taskController.js');
    getAllTasks(req, res);
  } catch (err) {
    next(err);
  }
});

router.post('/', auth, role(['admin', 'moderator']), async (req, res, next) => {
  try {
    const { createTask } = await import('../controllers/taskController.js');
    createTask(req, res);
  } catch (err) {
    next(err);
  }
});

router.put('/:taskId', auth, role(['admin', 'moderator']), async (req, res, next) => {
  try {
    const { updateTask } = await import('../controllers/taskController.js');
    updateTask(req, res);
  } catch (err) {
    next(err);
  }
});

router.delete('/:taskId', auth, role(['admin', 'moderator']), async (req, res, next) => {
  try {
    const { deleteTask } = await import('../controllers/taskController.js');
    deleteTask(req, res);
  } catch (err) {
    next(err);
  }
});

export default router;