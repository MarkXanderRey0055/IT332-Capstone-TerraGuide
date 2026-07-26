import Property from '../models/Property.js';
import AppError from '../utils/errors.js';

export const getAllProperties = async (searchQuery = '') => {
  let query = {};

  if (searchQuery) {
    query = {
      $or: [
        { name: { $regex: searchQuery, $options: 'i' } },
        { owner: { $regex: searchQuery, $options: 'i' } },
        { location: { $regex: searchQuery, $options: 'i' } },
      ],
    };
  }

  return await Property.find(query).sort({ createdAt: -1 });
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