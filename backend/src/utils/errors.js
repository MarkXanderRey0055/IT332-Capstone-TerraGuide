/**
 * Custom AppError class to represent operational errors.
 */
class AppError extends Error {
  /**
   * @param {string} message Error message
   * @param {number} statusCode HTTP status code (e.g., 400, 401, 403, 404)
   */
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;
