/**
 * Utility helper to send standard success JSON responses.
 * @param {object} res Express response object
 * @param {number} statusCode HTTP Status Code (default: 200)
 * @param {string} message Description message
 * @param {object} data Payload data
 */
export const sendSuccess = (res, statusCode = 200, message = 'Success', data = null) => {
  const response = {
    success: true,
    message
  };

  if (data !== null) {
    response.data = data;
  }

  return res.status(statusCode).json(response);
};

/**
 * Utility helper to send standard error JSON responses.
 * @param {object} res Express response object
 * @param {number} statusCode HTTP Status Code (default: 400)
 * @param {string} message Error message
 * @param {object} [errors] Additional detailed errors (optional)
 */
export const sendError = (res, statusCode = 400, message = 'An error occurred', errors = null) => {
  const response = {
    success: false,
    message
  };

  if (errors !== null) {
    response.errors = errors;
  }

  return res.status(statusCode).json(response);
};
