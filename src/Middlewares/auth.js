import jwt from 'jsonwebtoken';
import catchAsync from '../Utils/catchAsync.js';
import HandleError from '../Utils/handleError.js';

const auth = catchAsync(async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new HandleError('No token provided. Authentication required.', 401));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      playerId: decoded.playerId,
      role: decoded.role,
      rank: decoded.rank,
      groups: decoded.groups,
      verified: decoded.verified,
    };
  } catch (err) {
    return next(new HandleError('Invalid or expired token.', 401));
  }

  next();
});

export default auth;