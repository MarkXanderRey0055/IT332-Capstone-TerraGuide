import Property from '../models/Property.js';
import Transaction, { ACTIVE_TRANSACTION_STATUSES } from '../models/Transaction.js';
import AppError from '../utils/errors.js';

export const getAllProperties = async (queryParams = {}) => {
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

  // 1. Search filter (matches name, owner, or location)
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { owner: { $regex: search, $options: 'i' } },
      { location: { $regex: search, $options: 'i' } },
    ];
  }

  // 2. Specific Location filter
  if (location) {
    filter.location = { $regex: location, $options: 'i' };
  }

  // 3. Exact Property Type filter
  if (type) {
    filter.type = type;
  }

  // 4. Exact Status filter
  if (status) {
    filter.status = status;
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
  const properties = await Property.find(filter)
    .populate('documentVerificationHistory.changedBy', 'fullName username')
    .sort(sortOption)
    .skip(skip)
    .limit(limitNum);

  return {
    properties,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    },
  };
};

export const getPropertyById = async (id) => {
  const property = await Property.findById(id).populate('documentVerificationHistory.changedBy', 'fullName username');
  if (!property) {
    throw new AppError('Property listing not found', 404);
  }
  return property;
};

export const createProperty = async (data) => {
  return await Property.create(data);
};

export const updateProperty = async (id, data, updatedByUserId) => {
  const existing = await Property.findById(id);
  if (!existing) throw new AppError('Property listing not found', 404);

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
  const activeTx = await Transaction.findOne({
    propertyId: id,
    status: { $in: ACTIVE_TRANSACTION_STATUSES },
  });
  if (activeTx) {
    throw new AppError(
      `Cannot delete property because it has an active transaction (${activeTx.reference || activeTx.status}). Please complete or cancel the transaction first.`,
      409
    );
  }

  const property = await Property.findByIdAndDelete(id);

  if (!property) {
    throw new AppError('Property listing not found', 404);
  }

  return property;
};
