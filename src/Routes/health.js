// routes/health.js
import express from 'express';
const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const { healthCheck } = await import('../controllers/healthController.js');
    healthCheck(req, res);
  } catch (err) {
    next(err); // Pass errors to Express error handler
  }
});

export default router;