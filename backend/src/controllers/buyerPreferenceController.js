import * as buyerPreferenceService from '../services/buyerPreferenceService.js';
import { sendSuccess } from '../utils/response.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';

/**
 * @desc    Save or update preferences for the logged-in buyer
 * @route   POST /api/preferences
 * @access  Private (Buyer)
 */
export const savePreference = asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;

  const preference = await buyerPreferenceService.createOrUpdatePreference(
    userId,
    req.body
  );

  return sendSuccess(
    res,
    200,
    'Buyer preferences saved successfully.',
    preference
  );
});

/**
 * @desc    Get saved preferences for the logged-in buyer
 * @route   GET /api/preferences
 * @access  Private (Buyer)
 */
export const getMyPreference = asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;

  const preference = await buyerPreferenceService.getPreferenceByUser(userId);

  return sendSuccess(
    res,
    200,
    'Buyer preferences retrieved successfully.',
    preference
  );
});