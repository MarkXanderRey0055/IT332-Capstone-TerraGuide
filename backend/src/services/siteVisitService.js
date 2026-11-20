import mongoose from 'mongoose';
import SiteVisit from '../models/SiteVisit.js';
import Property from '../models/Property.js';
import AppError from '../utils/errors.js';
import { notifyAdminsOfNewSiteVisit, notifyBuyerOfSiteVisitUpdate } from './notificationService.js';

const POPULATE_BUYER = 'fullName username email';
const POPULATE_PROPERTY = 'name location type status';

function populateSiteVisit(query) {
  return query
    .populate('buyerId', POPULATE_BUYER)
    .populate('propertyId', POPULATE_PROPERTY);
}

export const createSiteVisit = async ({ buyerId, propertyId, preferredDate, preferredTime, notes }) => {
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

  const visit = await SiteVisit.create({ buyerId, propertyId, preferredDate, preferredTime: preferredTime || '', notes: notes || '' });
  await notifyAdminsOfNewSiteVisit(visit);
  return populateSiteVisit(SiteVisit.findById(visit._id));
};

export const getSiteVisitsForBuyer = async (buyerId) => {
  return populateSiteVisit(SiteVisit.find({ buyerId })).sort({ createdAt: -1 });
};

export const getAllSiteVisits = async () => {
  return populateSiteVisit(SiteVisit.find()).sort({ createdAt: -1 });
};

export const updateSiteVisitStatus = async (visitId, { status, adminResponse, confirmedDate, confirmedTime } = {}) => {
  if (!mongoose.Types.ObjectId.isValid(visitId)) {
    throw new AppError('Invalid site visit ID.', 400);
  }

  const visit = await SiteVisit.findById(visitId);
  if (!visit) {
    throw new AppError('Site visit not found.', 404);
  }

  const currentStatus = visit.status;
  const previousResponse = visit.adminResponse ?? '';
  const previousConfirmedDate = visit.confirmedDate ? new Date(visit.confirmedDate).getTime() : null;
  const previousConfirmedTime = visit.confirmedTime ?? '';
  const nextStatus = status ?? currentStatus;
  const allowed = currentStatus === nextStatus || (currentStatus === 'Pending' && nextStatus === 'Scheduled') || (currentStatus === 'Scheduled' && ['Completed', 'Pending'].includes(nextStatus));
  if (!allowed) throw new AppError(`Invalid site visit status transition: ${currentStatus} to ${nextStatus}.`, 400);

  if (nextStatus === 'Scheduled') {
    const nextDate = confirmedDate === undefined ? visit.confirmedDate : new Date(confirmedDate);
    const nextTime = confirmedTime === undefined ? visit.confirmedTime ?? '' : String(confirmedTime).trim();
    if (!nextDate || !Number.isFinite(new Date(nextDate).getTime())) {
      throw new AppError('A confirmed date is required when a site visit is Scheduled.', 400);
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(nextTime)) {
      throw new AppError('A confirmed time in HH:MM 24-hour format is required when a site visit is Scheduled.', 400);
    }
    visit.confirmedDate = nextDate;
    visit.confirmedTime = nextTime;
  } else {
    visit.confirmedDate = null;
    visit.confirmedTime = '';
  }
  visit.status = nextStatus;
  if (adminResponse !== undefined) visit.adminResponse = String(adminResponse).trim();
  const statusChanged = currentStatus !== nextStatus;
  const responseChanged = previousResponse !== (visit.adminResponse ?? '');
  const scheduleChanged = previousConfirmedDate !== (visit.confirmedDate ? new Date(visit.confirmedDate).getTime() : null)
    || previousConfirmedTime !== (visit.confirmedTime ?? '');
  await visit.save();
  await notifyBuyerOfSiteVisitUpdate({ siteVisit: visit, statusChanged, responseChanged, scheduleChanged });

  return populateSiteVisit(SiteVisit.findById(visitId));
};
