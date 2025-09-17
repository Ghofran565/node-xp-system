import catchAsync from '../Utils/catchAsync.js';
import HandleError from '../Utils/handleError.js';

const restrictTo = (...roles) => {
  return catchAsync(async (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new HandleError('You do not have permission to perform this action.', 403));
    }
    next();
  });
};

export const isAdmin = restrictTo('admin');
export const isModerator = restrictTo('moderator', 'admin');
export const isUser = restrictTo('user', 'moderator', 'admin');

export default { isAdmin, isModerator, isUser };