import * as siteVisitService from '../services/siteVisitService.js';
import { sendSuccess } from '../utils/response.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';
import AppError from '../utils/errors.js';

// Buyer: submit a new site visit request
export const createSiteVisit = asyncHandler(async (req, res) => {
  const { propertyId, preferredDate, preferredTime, notes } = req.body;

  if (!propertyId || !preferredDate) {
    throw new AppError('propertyId and preferredDate are required.', 400);
  }

  const parsedDate = new Date(preferredDate);
  if (!Number.isFinite(parsedDate.getTime()) ||
      (typeof preferredDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(preferredDate) &&
        parsedDate.toISOString().slice(0, 10) !== preferredDate)) {
    throw new AppError('Please select a valid preferred date.', 400);
  }

  if (preferredTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(preferredTime)) {
    throw new AppError('Preferred time must be in HH:MM 24-hour format.', 400);
  }

  // buyerId always comes from the authenticated user — never from the request body
  const visit = await siteVisitService.createSiteVisit({
    buyerId: req.user._id,
    propertyId,
    preferredDate,
    preferredTime: preferredTime || '',
    notes,
  });

  return sendSuccess(res, 201, 'Site visit request submitted successfully.', visit);
});

// Buyer: get own site visits
export const getMySiteVisits = asyncHandler(async (req, res) => {
  const visits = await siteVisitService.getSiteVisitsForBuyer(req.user._id);
  return sendSuccess(res, 200, 'Site visits fetched successfully.', visits);
});

// Admin: get all site visits
export const getAllSiteVisits = asyncHandler(async (req, res) => {
  const visits = await siteVisitService.getAllSiteVisits();
  return sendSuccess(res, 200, 'All site visits fetched successfully.', visits);
});

// Admin: update site visit status
export const updateSiteVisitStatus = asyncHandler(async (req, res) => {
  const { status, adminResponse } = req.body;

  if (status === undefined && adminResponse === undefined) {
    throw new AppError('status or adminResponse is required.', 400);
  }

  const visit = await siteVisitService.updateSiteVisitStatus(req.params.id, {
    status,
    adminResponse,
  });
  return sendSuccess(res, 200, 'Site visit status updated successfully.', visit);
});
