import express from 'express';
import verified from '../middlewares/verified.js';
import { login, register, verifyEmail, forgotPassword, resetPassword } from '../Controllers/authController.js';

const router = express.Router();

router.route('/register').post(register);
router.route('/verify-email').post(verifyEmail);
router.route('/login').post(login);
router.route('/forget-password').post(forgotPassword);
router.route('/reset-password').post(resetPassword);


// router.post('/register', async (req, res, next) => {
//   try {
//     const { register } = await import('../controllers/authController.js');
//     register(req, res);
//   } catch (err) {
//     next(err);
//   }
// });

// router.post('/verify-email', async (req, res, next) => {
//   try {
//     const { verifyEmail } = await import('../controllers/authController.js');
//     verifyEmail(req, res);
//   } catch (err) {
//     next(err);
//   }
// });

// router.post('/login', async (req, res, next) => {
//   try {
//     const { login } = await import('../controllers/authController.js');
//     login(req, res);
//   } catch (err) {
//     next(err);
//   }
// });

// router.post('/forgot-password', async (req, res, next) => {
//   try {
//     const { forgotPassword } = await import('../controllers/authController.js');
//     forgotPassword(req, res);
//   } catch (err) {
//     next(err);
//   }
// });

// router.post('/reset-password', async (req, res, next) => {
//   try {
//     const { resetPassword } = await import('../controllers/authController.js');
//     resetPassword(req, res);
//   } catch (err) {
//     next(err);
//   }
// });

export default router;