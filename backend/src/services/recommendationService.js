import BuyerPreference from '../models/BuyerPreference.js';
import Property from '../models/Property.js';
import AppError from '../utils/errors.js';

export const getBuyerRecommendations = async (userId) => {
  // 1. Fetch saved preferences for the logged-in buyer using 'userId'
  const preferences = await BuyerPreference.findOne({ userId: userId });

  if (!preferences) {
    throw new AppError('Buyer preferences not found.', 404);
  }

  // 2. Build dynamic query filter based on schema field names
  const filter = {
    status: 'Available',
  };

  // Location (case-insensitive search)
  if (preferences.location) {
    filter.location = { $regex: preferences.location, $options: 'i' };
  }

  // Land Type
  if (preferences.landType) {
    filter.type = preferences.landType;
  }

  // Budget Range (budgetMin & budgetMax)
  if (preferences.budgetMin !== undefined || preferences.budgetMax !== undefined) {
    filter.price = {};
    if (preferences.budgetMin !== undefined && !isNaN(preferences.budgetMin)) {
      filter.price.$gte = Number(preferences.budgetMin);
    }
    if (preferences.budgetMax !== undefined && !isNaN(preferences.budgetMax)) {
      filter.price.$lte = Number(preferences.budgetMax);
    }
  }

  // Minimum Lot Size
  if (preferences.minLotSize !== undefined && !isNaN(preferences.minLotSize)) {
    filter.lotSize = { $gte: Number(preferences.minLotSize) };
  }

  // 3. Query matching properties
  const recommendedProperties = await Property.find(filter).sort({ createdAt: -1 });

  return {
    preferences,
    totalMatches: recommendedProperties.length,
    properties: recommendedProperties,
  };
};