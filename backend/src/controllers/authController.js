import * as authService from '../services/authService.js';
import { sendSuccess } from '../utils/response.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
export const register = asyncHandler(async (req, res) => {
  const { username, email, password, fullName, address } = req.body;

  const result = await authService.registerUser({
    username,
    email,
    password,
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
  const userObj = typeof req.user?.toObject === 'function' ? req.user.toObject() : { ...req.user };
  delete userObj.password;
  delete userObj.profilePicturePublicId;
  userObj.profilePictureUrl = userObj.profilePictureUrl ?? null;
  userObj.contactNumber = userObj.contactNumber ?? null;
  return sendSuccess(res, 200, 'User profile fetched successfully', userObj);
});

/**
 * @desc    Upload or replace the authenticated buyer's profile picture
 * @route   POST /api/auth/me/profile-picture
 * @access  Private (Buyer)
 */
export const updateMyProfilePicture = asyncHandler(async (req, res) => {
  const result = await authService.updateMyProfilePicture(req.user._id || req.user.id, req.file);
  return sendSuccess(res, 200, 'Profile picture updated successfully', result);
});

/**
 * @desc    Update the authenticated buyer's editable personal information
 * @route   PUT /api/auth/me/profile
 * @access  Private (Buyer)
 */
export const updateMyProfile = asyncHandler(async (req, res) => {
  const updatedUser = await authService.updateMyProfile(req.user._id || req.user.id, req.body);
  return sendSuccess(res, 200, 'Profile information updated successfully', updatedUser);
});