import * as recommendationService from '../services/recommendationService.js';
import { sendSuccess } from '../utils/response.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';

// @desc    Get recommended properties based on buyer's saved preferences
// @route   GET /api/recommendations
// @access  Private (Buyer / Logged-in User)
export const getRecommendations = asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;
  console.log("=== RESOLVED USER ID ===", userId);
  const recommendations = await recommendationService.getBuyerRecommendations(userId);

  return sendSuccess(
    res,
    200,
    'Recommended properties fetched successfully',
    recommendations
  );
});