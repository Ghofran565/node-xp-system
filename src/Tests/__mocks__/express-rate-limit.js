// Tests/__mocks__/express-rate-limit.js
import { jest } from '@jest/globals';

const rateLimit = jest.fn().mockImplementation(() => (req, res, next) => {
  // Simulate rate limit exceeded for specific endpoints
  if (req.url.includes('complete') && req.headers['x-rate-limit-test'] === 'exceed') {
    return res.status(429).json({ message: 'Too many requests' });
  }
  next();
});

// Export as default to match `import rateLimit from 'express-rate-limit'`
export default rateLimit;