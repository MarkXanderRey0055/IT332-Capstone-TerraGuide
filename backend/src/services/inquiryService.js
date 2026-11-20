import mongoose from 'mongoose';
import Inquiry, { INQUIRY_CLOSING_STATUSES, INQUIRY_TERMINAL_STATUSES } from '../models/Inquiry.js';
import Property from '../models/Property.js';
import AppError from '../utils/errors.js';
import { notifyAdminsOfNewInquiry, notifyBuyerOfInquiryUpdate } from './notificationService.js';

const POPULATE_BUYER = 'fullName username email';
const POPULATE_PROPERTY = 'name location type status price';

function populateInquiry(query) {
  return query
    .populate('buyerId', POPULATE_BUYER)
    .populate('propertyId', POPULATE_PROPERTY);
}

export const createInquiry = async ({ buyerId, propertyId, message }) => {
  if (!mongoose.Types.ObjectId.isValid(propertyId)) {
    throw new AppError('Invalid property ID.', 400);
  }

  const property = await Property.findById(propertyId);
  if (!property) {
    throw new AppError('Property not found.', 404);
  }
  if (property.status === 'Sold' || property.status === 'Reserved') {
    throw new AppError('This property is no longer accepting inquiries or site visit requests.', 400);
  }

  const inquiry = await Inquiry.create({ buyerId, propertyId, message });
  await notifyAdminsOfNewInquiry(inquiry);
  return populateInquiry(Inquiry.findById(inquiry._id));
};

export const getInquiriesForBuyer = async (buyerId) => {
  return populateInquiry(Inquiry.find({ buyerId })).sort({ createdAt: -1 });
};

export const getAllInquiries = async () => {
  return populateInquiry(Inquiry.find()).sort({ createdAt: -1 });
};

export const updateInquiryStatus = async (inquiryId, { status, adminResponse, closeReason } = {}) => {
  if (!mongoose.Types.ObjectId.isValid(inquiryId)) {
    throw new AppError('Invalid inquiry ID.', 400);
  }

  const inquiry = await Inquiry.findById(inquiryId);
  if (!inquiry) {
    throw new AppError('Inquiry not found.', 404);
  }

  const currentStatus = inquiry.status;
  if (INQUIRY_TERMINAL_STATUSES.includes(currentStatus)) {
    throw new AppError('This inquiry is closed and can’t be changed.', 400);
  }
  if (status === undefined && adminResponse === undefined && closeReason === undefined) {
    throw new AppError('status, adminResponse, or closeReason is required.', 400);
  }

  const nextResponse = adminResponse === undefined ? inquiry.adminResponse ?? '' : String(adminResponse).trim();
  let nextStatus = status ?? currentStatus;
  if (nextStatus === 'Converted' && currentStatus !== 'Converted') {
    throw new AppError('Inquiries can only be converted by creating a linked transaction.', 400);
  }
  const currentIsClosing = INQUIRY_CLOSING_STATUSES.includes(currentStatus);
  const nextIsClosing = INQUIRY_CLOSING_STATUSES.includes(nextStatus);
  if (!nextIsClosing) {
    if (nextResponse && nextStatus === 'Pending') nextStatus = 'Responded';
    if (!nextResponse && nextStatus === 'Responded') nextStatus = 'Pending';
  }

  const allowed = currentStatus === nextStatus
    || (currentStatus === 'Pending' && ['Responded', ...INQUIRY_CLOSING_STATUSES].includes(nextStatus))
    || (currentStatus === 'Responded' && ['Pending', ...INQUIRY_CLOSING_STATUSES].includes(nextStatus));
  if (!allowed) throw new AppError(`Invalid inquiry status transition: ${currentStatus} to ${nextStatus}.`, 400);
  if (nextStatus === 'Responded' && !nextResponse.trim()) {
    throw new AppError('An admin response is required when an inquiry is Responded.', 400);
  }
  const nextCloseReason = closeReason === undefined
    ? inquiry.closeReason ?? ''
    : String(closeReason).trim();
  if (nextIsClosing && !nextCloseReason.trim()) {
    throw new AppError('A reason is required when closing an inquiry.', 400);
  }

  const statusChanged = currentStatus !== nextStatus;
  const responseChanged = (inquiry.adminResponse ?? '') !== nextResponse;
  inquiry.status = nextStatus;
  if (adminResponse !== undefined) inquiry.adminResponse = nextResponse;
  inquiry.closeReason = nextIsClosing ? nextCloseReason : '';
  if (nextIsClosing) {
    if (!currentIsClosing || !inquiry.closedAt) inquiry.closedAt = new Date();
  } else {
    inquiry.closedAt = null;
  }
  await inquiry.save();
  await notifyBuyerOfInquiryUpdate({ inquiry, statusChanged, responseChanged });

  return populateInquiry(Inquiry.findById(inquiryId));
};
