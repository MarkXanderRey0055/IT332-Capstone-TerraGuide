import * as adminBuyerService from '../services/adminBuyerService.js';
import { sendSuccess } from '../utils/response.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';

/**
 * @desc    List all registered buyers, joined with their saved preferences
 * @route   GET /api/admin/buyers?search=
 * @access  Private (Admin)
 */
export const getBuyers = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const buyers = await adminBuyerService.listBuyers(search);
  return sendSuccess(res, 200, 'Buyers fetched successfully', buyers);
});

/**
 * @desc    Create a new buyer account (optionally with preferences)
 * @route   POST /api/admin/buyers
 * @access  Private (Admin)
 */
export const createBuyer = asyncHandler(async (req, res) => {
  const buyer = await adminBuyerService.createBuyer(req.body);
  return sendSuccess(res, 201, 'Buyer account created successfully', buyer);
});

/**
 * @desc    Update a buyer's account and/or preference fields
 * @route   PUT /api/admin/buyers/:userId
 * @access  Private (Admin)
 */
export const updateBuyer = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const buyer = await adminBuyerService.updateBuyer(userId, req.body);
  return sendSuccess(res, 200, 'Buyer profile updated successfully', buyer);
});

/**
 * @desc    Delete a buyer account and their saved preferences
 * @route   DELETE /api/admin/buyers/:userId
 * @access  Private (Admin)
 */
export const deleteBuyer = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  await adminBuyerService.deleteBuyer(userId);
  return sendSuccess(res, 200, 'Buyer account deleted successfully', null);
});