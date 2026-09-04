import * as inquiryService from '../services/inquiryService.js';
import { sendSuccess } from '../utils/response.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';
import AppError from '../utils/errors.js';

// Buyer: submit a new inquiry
export const createInquiry = asyncHandler(async (req, res) => {
  const { propertyId, message } = req.body;

  if (!propertyId || !message?.trim()) {
    throw new AppError('propertyId and message are required.', 400);
  }

  // buyerId always comes from the authenticated user — never from the request body
  const inquiry = await inquiryService.createInquiry({
    buyerId: req.user._id,
    propertyId,
    message: message.trim(),
  });

  return sendSuccess(res, 201, 'Inquiry submitted successfully.', inquiry);
});

// Buyer: get own inquiries
export const getMyInquiries = asyncHandler(async (req, res) => {
  const inquiries = await inquiryService.getInquiriesForBuyer(req.user._id);
  return sendSuccess(res, 200, 'Inquiries fetched successfully.', inquiries);
});

// Admin: get all inquiries
export const getAllInquiries = asyncHandler(async (req, res) => {
  const inquiries = await inquiryService.getAllInquiries();
  return sendSuccess(res, 200, 'All inquiries fetched successfully.', inquiries);
});

// Admin: update inquiry status
export const updateInquiryStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  if (!status) {
    throw new AppError('status is required.', 400);
  }

  const inquiry = await inquiryService.updateInquiryStatus(req.params.id, status);
  return sendSuccess(res, 200, 'Inquiry status updated successfully.', inquiry);
});
