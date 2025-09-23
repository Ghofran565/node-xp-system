import express from 'express';
import { getAssignedTasks, getTaskDetails, completeTask, getAllTasks, createTask, updateTask, deleteTask } from '../controllers/taskController.js';
import auth from '../middlewares/auth.js';
import role from '../middlewares/role.js';
import verified from '../middlewares/verified.js';

const router = express.Router();

router.get('/assigned', auth, verified, getAssignedTasks);
router.get('/:taskId', auth, verified, getTaskDetails);
router.post('/:taskId/complete', auth, verified, completeTask);
router.get('/all', auth, role(['admin', 'moderator']), getAllTasks);
router.post('/', auth, role(['admin', 'moderator']), createTask);
router.put('/:taskId', auth, role(['admin', 'moderator']), updateTask);
router.delete('/:taskId', auth, role(['admin', 'moderator']), deleteTask);

export default router;