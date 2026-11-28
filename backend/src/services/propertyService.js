import Property from '../models/Property.js';
import Audit from '../models/Audit.js';
import Transaction from '../models/Transaction.js';
import AppError from '../utils/errors.js';
import { cleanupCloudinaryAssets, uploadPropertyImagesToCloudinary } from './imageStorageService.js';
import mongoose from 'mongoose';
import { BUYER_VISIBLE_PROPERTY_STATUS } from '../../../shared/propertyVisibility.mjs';
import { expandBuyerPropertyTypeFilter } from '../../../shared/propertyCategories.mjs';
import { compareReadinessFreshness } from '../utils/auditReadiness.js';
import { toPublicProperties, toPublicProperty } from '../utils/publicPropertyView.js';
import SearchEvent from '../models/SearchEvent.js';

function recordBuyerSearchEvent(queryParams, user, resultCount) {
  if (queryParams.recordSearch !== 'true' || (user && user.role !== 'buyer')) return;
  const { search, type, location, minPrice, maxPrice } = queryParams;
  if (![search, type, location, minPrice, maxPrice].some((value) => value !== undefined && String(value).trim() !== '')) return;

  const event = {
    ...(user?.role === 'buyer' ? { buyerId: user._id ?? user.id } : {}),
    ...(type ? { propertyType: String(type).trim() } : {}),
    ...(location ? { location: String(location) } : {}),
    ...(minPrice !== undefined && Number.isFinite(Number(minPrice)) ? { minPrice: Number(minPrice) } : {}),
    ...(maxPrice !== undefined && Number.isFinite(Number(maxPrice)) ? { maxPrice: Number(maxPrice) } : {}),
    resultCount,
  };

  try {
    void SearchEvent.create(event).catch((error) => {
      console.error('[search-event] best-effort write failed:', error?.message ?? error);
    });
  } catch (error) {
    console.error('[search-event] best-effort write failed:', error?.message ?? error);
  }
}

async function getLatestAuditStates(properties) {
  if (properties.length === 0) return new Map();

  const latestAudits = await Audit.aggregate([
    { $match: { propertyId: { $in: properties.map((property) => property._id) } } },
    { $sort: { generatedAt: -1 } },
    { $group: { _id: '$propertyId', audit: { $first: '$$ROOT' } } },
  ]);
  const auditByPropertyId = new Map(
    latestAudits.map(({ _id, audit }) => [String(_id), audit])
  );

  return new Map(properties.map((property) => {
    const propertyId = String(property._id);
    const audit = auditByPropertyId.get(propertyId);
    if (!audit) return [propertyId, { status: 'NOT_AUDITED', auditedAt: null }];

    const { freshnessStatus } = compareReadinessFreshness(audit, property);
    const status = freshnessStatus === 'CURRENT'
      ? 'AUDITED'
      : freshnessStatus === 'STALE'
        ? 'STALE'
        : 'UNKNOWN';
    return [propertyId, { status, auditedAt: audit.generatedAt ?? null }];
  }));
}

export const getAllProperties = async (queryParams = {}, user = null) => {
  const {
    search,
    location,
    type,
    status,
    minPrice,
    maxPrice,
    minLotSize,
    sort = 'latest',
    page = 1,
    limit = 12,
  } = queryParams;

  // Build MongoDB query filter dynamically
  const filter = {};
  const isAdmin = user?.role === 'admin';

  // Discovery is always Available-only for buyers and anonymous visitors.
  // Only a verified admin may use an explicit status filter or see all statuses.
  if (isAdmin) {
    if (status) filter.status = status;
  } else {
    filter.status = BUYER_VISIBLE_PROPERTY_STATUS;
  }

  // 1. Search filter (matches name or location; owner matching is admin-only)
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      ...(isAdmin ? [{ owner: { $regex: search, $options: 'i' } }] : []),
      { location: { $regex: search, $options: 'i' } },
    ];
  }

  // 2. Specific Location filter
  if (location) {
    filter.location = { $regex: location, $options: 'i' };
  }

  // 3. Property Type filter (buyers expand Residential to all residential subtypes;
  // admins retain exact subtype filtering)
  if (type) {
    if (!isAdmin) {
      const matchedTypes = expandBuyerPropertyTypeFilter(type);
      filter.type = matchedTypes.length > 1 ? { $in: matchedTypes } : matchedTypes[0];
    } else {
      filter.type = type;
    }
  }

  // 5. Price Range filter
  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {};
    if (minPrice !== undefined && !isNaN(Number(minPrice))) {
      filter.price.$gte = Number(minPrice);
    }
    if (maxPrice !== undefined && !isNaN(Number(maxPrice))) {
      filter.price.$lte = Number(maxPrice);
    }
  }

  // 6. Minimum Lot Size filter
  if (minLotSize !== undefined && !isNaN(Number(minLotSize))) {
    filter.lotSize = { $gte: Number(minLotSize) };
  }

  // Configure Sorting
  let sortOption = { createdAt: -1 }; // default 'latest'
  if (sort === 'priceAsc') {
    sortOption = { price: 1 };
  } else if (sort === 'priceDesc') {
    sortOption = { price: -1 };
  } else if (sort === 'latest') {
    sortOption = { createdAt: -1 };
  }

  // Configure Pagination
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, parseInt(limit, 10) || 12);
  const skip = (pageNum - 1) * limitNum;

  // Execute query with total count
  const total = await Property.countDocuments(filter);
  let query = Property.find(filter);
  if (isAdmin) {
    query = query.populate('documentVerificationHistory.changedBy', 'fullName username');
  }
  const properties = await query
    .sort(sortOption)
    .skip(skip)
    .limit(limitNum);

  // Search analytics are explicitly opted into and never block discovery.
  recordBuyerSearchEvent(queryParams, user, total);

  let responseProperties = isAdmin ? properties : toPublicProperties(properties);
  if (isAdmin) {
    const auditStates = await getLatestAuditStates(properties);
    responseProperties = properties.map((property) => ({
      ...(typeof property.toObject === 'function'
        ? property.toObject({ virtuals: true })
        : { ...property, id: property.id ?? String(property._id) }),
      auditState: auditStates.get(String(property._id)),
    }));
  }

  return {
    properties: responseProperties,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    },
  };
};

export const getPropertyById = async (id, user = null) => {
  const isAdmin = user?.role === 'admin';
  let query = Property.findById(id);
  if (isAdmin && typeof query?.populate === 'function') {
    query = query.populate('documentVerificationHistory.changedBy', 'fullName username');
  }
  const property = await query;
  if (!property) {
    throw new AppError('Property listing not found', 404);
  }
  return isAdmin ? property : toPublicProperty(property);
};

const validateRequiredPositivePropertyValues = (values) => {
  const errors = {};
  if (typeof values.owner !== 'string' || !values.owner.trim()) {
    errors.owner = 'Owner name is required.';
  }
  if (typeof values.price !== 'number' || !Number.isFinite(values.price) || values.price <= 0) {
    errors.price = 'Please enter a valid price greater than 0.';
  }
  if (typeof values.lotSize !== 'number' || !Number.isFinite(values.lotSize) || values.lotSize <= 0) {
    errors.lotSize = 'Please enter a valid lot size greater than 0.';
  }
  if (Object.keys(errors).length > 0) {
    throw new AppError('One or more property fields are invalid.', 400, errors);
  }
};

export const createProperty = async (data) => {
  validateRequiredPositivePropertyValues(data);
  return await Property.create(data);
};

export const appendPropertyImages = async (id, files) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError('Invalid property ID.', 400);
  }
  if (!Array.isArray(files) || files.length === 0) {
    throw new AppError('At least one image file is required.', 400);
  }

  const existing = await Property.findById(id);
  if (!existing) throw new AppError('Property listing not found', 404);

  const currentImages = Array.isArray(existing.images) ? existing.images : [];
  if (currentImages.length + files.length > 5) {
    throw new AppError(`This property can have a maximum of 5 images. It currently has ${currentImages.length}.`, 400);
  }

  const uploaded = await uploadPropertyImagesToCloudinary(id, files);
  const nextImages = [...currentImages, ...uploaded.map((asset) => asset.url)];

  try {
    existing.images = nextImages;
    await existing.save();
  } catch (error) {
    await cleanupCloudinaryAssets(uploaded);
    throw error;
  }

  return { property: existing, uploadedImages: uploaded };
};

export const updateProperty = async (id, data, updatedByUserId, { allowTransactionStatus = false } = {}) => {
  const existing = await Property.findById(id);
  if (!existing) throw new AppError('Property listing not found', 404);

  if (
    !allowTransactionStatus &&
    data.status !== undefined &&
    data.status !== existing.status &&
    ['Reserved', 'Sold'].includes(data.status)
  ) {
    throw new AppError('Reserved and Sold are set by transactions.', 400);
  }

  validateRequiredPositivePropertyValues({
    owner: data.owner !== undefined ? data.owner : existing.owner,
    price: data.price !== undefined ? data.price : existing.price,
    lotSize: data.lotSize !== undefined ? data.lotSize : existing.lotSize,
  });

  const documentKeys = ['deed', 'tax', 'survey'];
  const nextDocuments = data.documents || {};
  if (updatedByUserId && existing.documents) {
    for (const document of documentKeys) {
      const previousStatus = existing.documents[document] || 'pending';
      const newStatus = nextDocuments[document] ?? previousStatus;
      if (newStatus !== previousStatus) {
        existing.documentVerificationHistory.push({
          document,
          previousStatus,
          newStatus,
          remarks: data.verificationRemarks ?? existing.verificationRemarks ?? '',
          changedBy: updatedByUserId,
        });
      }
    }
  }

  const updateData = { ...data };
  if (data.documents) {
    updateData.documents = { ...(existing.documents?.toObject?.() || existing.documents || {}), ...data.documents };
  }
  Object.assign(existing, updateData);
  // Plain-object mocks used by the service tests do not expose Mongoose's
  // save() method; retain the existing update path for those callers.
  const property = typeof existing.save === 'function'
    ? await existing.save()
    : await Property.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });

  if (!property) {
    throw new AppError('Property listing not found', 404);
  }

  return property;
};

export const deleteProperty = async (id) => {
  const session = await mongoose.startSession();
  let deletedProperty;
  try {
    await session.withTransaction(async () => {
      const transaction = await Transaction.findOne({ propertyId: id }).session(session);
      if (transaction) {
        throw new AppError('This property has transaction records and can’t be deleted. Archive it instead.', 409);
      }

      deletedProperty = await Property.findByIdAndDelete(id).session(session);
      if (!deletedProperty) {
        throw new AppError('Property listing not found', 404);
      }
    });
  } finally {
    await session.endSession();
  }

  return deletedProperty;
};
