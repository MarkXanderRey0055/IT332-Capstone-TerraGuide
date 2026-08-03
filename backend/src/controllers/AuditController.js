import * as auditService from '../services/auditService.js';
import { sendSuccess } from '../utils/response.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';
import AppError from '../utils/errors.js';

// @desc    Generate a new AI compliance audit for a property
// @route   POST /api/audits/generate
// @access  Private (Admin)
export const generateAudit = asyncHandler(async (req, res) => {
  const { propertyId } = req.body;

  if (!propertyId) {
    throw new AppError('propertyId is required.', 400);
  }

  const adminUserId = req.user._id || req.user.id;
  const audit = await auditService.generateAudit(propertyId, adminUserId);

  return sendSuccess(
    res,
    201,
    'Compliance audit generated successfully.',
    audit
  );
});

// @desc    Get the full audit history for a property (newest first)
// @route   GET /api/audits/:propertyId
// @access  Private (Admin)
export const getAuditHistory = asyncHandler(async (req, res) => {
  const { propertyId } = req.params;

  const audits = await auditService.getAuditHistory(propertyId);

  return sendSuccess(
    res,
    200,
    'Audit history retrieved successfully.',
    audits
  );
});