import catchAsync from '../Utils/catchAsync.js';
import HandleError from '../Utils/handleError.js';

const requireVerification = catchAsync(async (req, res, next) => {
  if (!req.user || !req.user.verified) {
    return next(new HandleError('Please verify your email before proceeding.', 403));
  }
  next();
});

export default requireVerification;