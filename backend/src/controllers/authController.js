import * as authService from '../services/authService.js';
import { sendSuccess } from '../utils/response.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';




export const register = asyncHandler(async (req, res) => {
  console.log("=== REGISTER HIT ===");
  console.log(req.body);

  const { username, email, password, role } = req.body;

  const result = await authService.registerUser({
    username,
    email,
    password,
    role
  });

  return sendSuccess(res, 201, "User registered successfully", result);
});
/**
 * 
 * 
 * 
 * 
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */


/**
 * @desc    Log in an existing user
 * @route   POST /api/auth/login
 * @access  Public
 */
export const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  const result = await authService.loginUser({
    username,
    password
  });

  return sendSuccess(res, 200, 'Login successful', result);
});

/**
 * @desc    Get currently logged-in user details
 * @route   GET /api/auth/me
 * @access  Private
 */
export const me = asyncHandler(async (req, res) => {
  const result = await authService.getMe(req.user._id);

  return sendSuccess(res, 200, 'User profile retrieved successfully', { user: result });
});
