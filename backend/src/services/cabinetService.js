import mongoose from 'mongoose';
import Cabinet, { CABINET_COLORS } from '../models/Cabinet.js';
import Property from '../models/Property.js';
import AppError from '../utils/errors.js';

export const listCabinets = async () => {
  const cabinets = await Cabinet.find().sort({ createdAt: -1 });

  const counts = await Property.aggregate([
    { $match: { cabinetId: { $ne: null } } },
    { $group: { _id: '$cabinetId', count: { $sum: 1 } } },
  ]);
  const countsByCabinetId = new Map(counts.map((c) => [c._id.toString(), c.count]));

  const unassignedCount = await Property.countDocuments({ cabinetId: null });

  const cabinetsWithCounts = cabinets.map((cabinet) => {
    const filedCount = countsByCabinetId.get(cabinet._id.toString()) || 0;
    return {
      ...cabinet.toJSON(),
      filedCount,
      remainingCapacity: Math.max(cabinet.capacity - filedCount, 0),
    };
  });

  return { cabinets: cabinetsWithCounts, unassignedCount };
};

export const createCabinet = async ({ name, description, capacity, color }) => {
  if (!name || !name.trim()) {
    throw new AppError('Cabinet name is required.', 400);
  }

  const capacityNum = Number(capacity);
  if (!Number.isFinite(capacityNum) || capacityNum < 1) {
    throw new AppError('Capacity must be a number of at least 1.', 400);
  }

  if (color && !CABINET_COLORS.includes(color)) {
    throw new AppError(`Color must be one of: ${CABINET_COLORS.join(', ')}`, 400);
  }

  const cabinet = await Cabinet.create({
    name: name.trim(),
    description: description ? description.trim() : '',
    capacity: capacityNum,
    color: color || 'green',
  });

  return { ...cabinet.toJSON(), filedCount: 0, remainingCapacity: cabinet.capacity };
};

export const updateCabinet = async (cabinetId, { name, description, capacity, color }) => {
  const cabinet = await Cabinet.findById(cabinetId);
  if (!cabinet) {
    throw new AppError('Filing cabinet not found.', 404);
  }

  if (name !== undefined) {
    if (!name.trim()) {
      throw new AppError('Cabinet name is required.', 400);
    }
    cabinet.name = name.trim();
  }

  if (description !== undefined) {
    cabinet.description = description.trim();
  }

  if (color !== undefined) {
    if (!CABINET_COLORS.includes(color)) {
      throw new AppError(`Color must be one of: ${CABINET_COLORS.join(', ')}`, 400);
    }
    cabinet.color = color;
  }

  if (capacity !== undefined) {
    const capacityNum = Number(capacity);
    if (!Number.isFinite(capacityNum) || capacityNum < 1) {
      throw new AppError('Capacity must be a number of at least 1.', 400);
    }

    const filedCount = await Property.countDocuments({ cabinetId: cabinet._id });
    if (capacityNum < filedCount) {
      throw new AppError(
        `This cabinet currently contains ${filedCount} properties. Capacity cannot be lower than the number of filed properties.`,
        400
      );
    }
    cabinet.capacity = capacityNum;
  }

  await cabinet.save();

  const filedCount = await Property.countDocuments({ cabinetId: cabinet._id });
  return {
    ...cabinet.toJSON(),
    filedCount,
    remainingCapacity: Math.max(cabinet.capacity - filedCount, 0),
  };
};

export const deleteCabinet = async (cabinetId) => {
  const cabinet = await Cabinet.findById(cabinetId);
  if (!cabinet) {
    throw new AppError('Filing cabinet not found.', 404);
  }

  await Property.updateMany({ cabinetId: cabinet._id }, { $set: { cabinetId: null } });
  await Cabinet.findByIdAndDelete(cabinetId);
};

export const assignPropertiesToCabinet = async (cabinetId, propertyIds) => {
  if (!Array.isArray(propertyIds) || propertyIds.length === 0) {
    throw new AppError('Select at least one property to file.', 400);
  }

  const cabinet = await Cabinet.findById(cabinetId);
  if (!cabinet) {
    throw new AppError('Filing cabinet not found.', 404);
  }

  const invalidIds = propertyIds.filter((id) => !mongoose.Types.ObjectId.isValid(id));
  if (invalidIds.length > 0) {
    throw new AppError('One or more property IDs are invalid.', 400);
  }

  const alreadyHereCount = await Property.countDocuments({
    _id: { $in: propertyIds },
    cabinetId: cabinet._id,
  });
  const currentCount = await Property.countDocuments({ cabinetId: cabinet._id });
  const remainingSlots = cabinet.capacity - currentCount + alreadyHereCount;

  if (propertyIds.length > remainingSlots) {
    throw new AppError(
      `This cabinet only has ${remainingSlots} slot(s) remaining, but ${propertyIds.length} properties were selected.`,
      400
    );
  }

  const result = await Property.updateMany(
    { _id: { $in: propertyIds } },
    { $set: { cabinetId: cabinet._id } }
  );

  if (result.matchedCount !== propertyIds.length) {
    throw new AppError('One or more selected properties could not be found.', 404);
  }

  return { filedCount: result.modifiedCount };
};

export const removePropertyFromCabinet = async (propertyId) => {
  const property = await Property.findById(propertyId);
  if (!property) {
    throw new AppError('Property listing not found.', 404);
  }

  property.cabinetId = null;
  await property.save();

  return property;
};