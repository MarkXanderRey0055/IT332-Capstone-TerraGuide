import mongoose from 'mongoose';
import SiteVisit from '../models/SiteVisit.js';
import Property from '../models/Property.js';
import AppError from '../utils/errors.js';

const POPULATE_BUYER = 'fullName username email';
const POPULATE_PROPERTY = 'name location type status';

function populateSiteVisit(query) {
  return query
    .populate('buyerId', POPULATE_BUYER)
    .populate('propertyId', POPULATE_PROPERTY);
}

export const createSiteVisit = async ({ buyerId, propertyId, preferredDate, notes }) => {
  if (!mongoose.Types.ObjectId.isValid(propertyId)) {
    throw new AppError('Invalid property ID.', 400);
  }

  const property = await Property.findById(propertyId);
  if (!property) {
    throw new AppError('Property not found.', 404);
  }

  const visit = await SiteVisit.create({ buyerId, propertyId, preferredDate, notes: notes || '' });
  return populateSiteVisit(SiteVisit.findById(visit._id));
};

export const getSiteVisitsForBuyer = async (buyerId) => {
  return populateSiteVisit(SiteVisit.find({ buyerId })).sort({ createdAt: -1 });
};

export const getAllSiteVisits = async () => {
  return populateSiteVisit(SiteVisit.find()).sort({ createdAt: -1 });
};

export const updateSiteVisitStatus = async (visitId, status) => {
  if (!mongoose.Types.ObjectId.isValid(visitId)) {
    throw new AppError('Invalid site visit ID.', 400);
  }

  const visit = await populateSiteVisit(
    SiteVisit.findByIdAndUpdate(visitId, { status }, { new: true, runValidators: true })
  );

  if (!visit) {
    throw new AppError('Site visit not found.', 404);
  }

  return visit;
};
