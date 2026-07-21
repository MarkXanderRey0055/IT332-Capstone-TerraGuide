import { sendError } from '../utils/response.js';

/**
 * Centered error handling middleware.
 */
export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
    const messages = Object.values(err.errors).map((el) => el.message);
    message = messages.join('. ');
  }

  // Handle Mongoose duplicate key errors (e.g., duplicate username or email)
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue)[0];
    message = `A user with this ${field} already exists.`;
  }

  // Handle Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid format for field ${err.path}`;
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token. Please login again.';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token expired. Please login again.';
  }

  // Log non-operational errors for debugging
  if (!err.isOperational) {
    console.error('💥 SYSTEM ERROR:', err);
  }

  return sendError(res, statusCode, message);
};

/**
 * Async wrapper to eliminate try-catch blocks in controllers.
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
