import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import AppError from '../utils/errors.js';
import { asyncHandler } from './errorMiddleware.js';

/**
 * Middleware to verify JWT and authenticate the request.
 */
export const protect = asyncHandler(async (req, res, next) => {
  let token;

  // 1. Check if token is provided in Authorization header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    throw new AppError('Access denied. No authentication token provided.', 401);
  }

  // 2. Verify token
  const jwtSecret = process.env.JWT_SECRET || 'your_jwt_secret_key_change_in_production';
  const decoded = jwt.verify(token, jwtSecret);

  // 3. Check if user still exists in database
  const currentUser = await User.findById(decoded.id).select('-password');
  if (!currentUser) {
    throw new AppError('The user belonging to this token no longer exists.', 401);
  }

  // 4. Attach user to request
  req.user = currentUser;
  next();
});

/** Authenticate when a valid bearer token is supplied, without requiring one. */
export const optionalProtect = asyncHandler(async (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) return next();

  let decoded;
  try {
    const token = authorization.split(' ')[1];
    const jwtSecret = process.env.JWT_SECRET || 'your_jwt_secret_key_change_in_production';
    decoded = jwt.verify(token, jwtSecret);
  } catch {
    // Public discovery remains available to anonymous clients, including stale sessions.
    return next();
  }

  const currentUser = await User.findById(decoded.id).select('-password');
  if (currentUser) req.user = currentUser;

  return next();
});

/**
 * Middleware to restrict route access by role.
 * @param {...string} roles Allowed roles ('admin', 'buyer')
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('User not authenticated.', 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action.', 403)
      );
    }

    next();
  };
};
