import AppError from '../utils/errors.js';

export const validatePropertyInput = (req, res, next) => {
  const { name, location, type, price, lat, lng, status, documents } = req.body;

  // validate fields
  if (req.method === 'POST') {
    if (!name || !location || !type || price === undefined || lat === undefined || lng === undefined) {
      return next(new AppError('Missing required fields: name, location, type, price, lat, and lng are required.', 400));
    }
  }

  // property price
  if (price !== undefined && (typeof price !== 'number' || price < 0)) {
    return next(new AppError('Price must be a positive number', 400));
  }

  // coordinates
  if (lat !== undefined && (typeof lat !== 'number' || isNaN(lat))) {
    return next(new AppError('Latitude must be a valid number', 400));
  }

  if (lng !== undefined && (typeof lng !== 'number' || isNaN(lng))) {
    return next(new AppError('Longitude must be a valid number', 400));
  }

  // property type 
  const validTypes = ['Residential', 'House & Lot', 'Agricultural', 'Commercial'];
  if (type && !validTypes.includes(type)) {
    return next(new AppError(`Property type must be one of: ${validTypes.join(', ')}`, 400));
  }

  // Status
  const validStatuses = ['Available', 'Reserved', 'Sold'];
  if (status && !validStatuses.includes(status)) {
    return next(new AppError(`Status must be one of: ${validStatuses.join(', ')}`, 400));
  }

  // Document status 
  if (documents) {
    const validDocStatuses = ['pending', 'verified', 'missing'];
    const docKeys = ['deed', 'tax', 'survey'];

    for (const key of docKeys) {
      if (documents[key] && !validDocStatuses.includes(documents[key])) {
        return next(new AppError(`Document status for '${key}' must be one of: ${validDocStatuses.join(', ')}`, 400));
      }
    }
  }

  next();
};