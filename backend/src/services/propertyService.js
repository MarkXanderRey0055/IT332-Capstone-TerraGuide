import Property from '../models/Property.js';
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
  const property = await Property.findById(id);
  if (!property) {
    throw new AppError('Property listing not found', 404);
  }
  return property;
};

export const createProperty = async (data) => {
  return await Property.create(data);
};

export const updateProperty = async (id, data) => {
  const property = await Property.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  });

  if (!property) {
    throw new AppError('Property listing not found', 404);
  }

  return property;
};

export const deleteProperty = async (id) => {
  const property = await Property.findByIdAndDelete(id);

  if (!property) {
    throw new AppError('Property listing not found', 404);
  }

  return property;
};