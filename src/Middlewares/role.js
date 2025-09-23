import catchAsync from '../Utils/catchAsync.js';
import HandleError from '../Utils/handleError.js';

/**
 * Middleware to restrict access to specific roles
 * @param {...string} roles - Roles allowed to access the route
 * @returns {Function} Middleware function
 */
const role = (...roles) => {
  return catchAsync(async (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new HandleError('You do not have permission to perform this action.', 403));
    }
    next();
  });
};

// Named exports for specific roles
export const isAdmin = role('admin');
export const isModerator = role('moderator', 'admin');
export const isUser = role('user', 'moderator', 'admin');

export default role;