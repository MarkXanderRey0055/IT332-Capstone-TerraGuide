import * as aiUsageService from '../services/aiUsageService.js';
import { sendSuccess } from '../utils/response.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';

/**
 * @desc    Get today's AI usage status (daily quota, RPM status, and a
 *          per-feature breakdown) for the Admin Dashboard
 * @route   GET /api/ai/usage
 * @access  Private (Admin)
 */
export const getUsage = asyncHandler(async (req, res) => {
  const status = await aiUsageService.getUsageStatus();
  return sendSuccess(res, 200, 'AI usage status retrieved successfully', status);
});
