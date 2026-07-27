import * as authService from '../services/authService.js';
import { sendSuccess } from '../utils/response.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
export const register = asyncHandler(async (req, res) => {
  console.log("=== REGISTER HIT ===");
  console.log(req.body);

  const { username, email, password, role, fullName, address } = req.body;

  const result = await authService.registerUser({
    username,
    email,
    password,
    role,
    fullName,
    address
  });

  return sendSuccess(res, 201, "User registered successfully", result);
});

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
export const getMe = asyncHandler(async (req, res) => {
  return sendSuccess(res, 200, 'User profile fetched successfully', req.user);
});