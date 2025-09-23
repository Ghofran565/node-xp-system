// routes/auth.js
import express from 'express';
import { register, verifyEmail, login, forgotPassword, resetPassword } from '../controllers/authController.js';
import verified from '../middlewares/verified.js';

const router = express.Router();

router.post('/register', register);
router.post('/verify-email', verifyEmail);
router.post('/login', login);
router.post('/forgot-password',  forgotPassword);
router.post('/reset-password', resetPassword);

export default router;