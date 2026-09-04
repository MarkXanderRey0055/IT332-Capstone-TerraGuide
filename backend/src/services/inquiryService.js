import mongoose from 'mongoose';
import Inquiry from '../models/Inquiry.js';
import Property from '../models/Property.js';
import AppError from '../utils/errors.js';

const POPULATE_BUYER = 'fullName username email';
const POPULATE_PROPERTY = 'name location type status';

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

  const inquiry = await Inquiry.create({ buyerId, propertyId, message });
  return populateInquiry(Inquiry.findById(inquiry._id));
};

export const getInquiriesForBuyer = async (buyerId) => {
  return populateInquiry(Inquiry.find({ buyerId })).sort({ createdAt: -1 });
};

export const getAllInquiries = async () => {
  return populateInquiry(Inquiry.find()).sort({ createdAt: -1 });
};

export const updateInquiryStatus = async (inquiryId, status) => {
  if (!mongoose.Types.ObjectId.isValid(inquiryId)) {
    throw new AppError('Invalid inquiry ID.', 400);
  }

  const inquiry = await populateInquiry(
    Inquiry.findByIdAndUpdate(inquiryId, { status }, { new: true, runValidators: true })
  );

  if (!inquiry) {
    throw new AppError('Inquiry not found.', 404);
  }

  return inquiry;
};
