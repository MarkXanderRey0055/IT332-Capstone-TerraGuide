import BuyerPreference from '../models/BuyerPreference.js';
import AppError from '../utils/errors.js';

/**
 * Save or update preferences for a logged-in buyer
 */
export const createOrUpdatePreference = async (userId, preferenceData) => {
  const preference = await BuyerPreference.findOneAndUpdate(
    { userId: userId },
    { $set: { ...preferenceData, userId: userId } },
    { new: true, upsert: true, runValidators: true }
  );

  return preference;
};

/**
 * Fetch saved preferences for a logged-in buyer
 */
export const getPreferenceByUser = async (userId) => {
  const preference = await BuyerPreference.findOne({ userId: userId });

  if (!preference) {
    throw new AppError('Buyer preferences not found.', 404);
  }

  return preference;
};