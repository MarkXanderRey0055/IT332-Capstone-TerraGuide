import BuyerPreference from '../models/BuyerPreference.js';
import Property from '../models/Property.js';
import AppError from '../utils/errors.js';


const scoreBudgetMatch = (price, budgetMin, budgetMax) => {
  const hasMin = budgetMin !== undefined && budgetMin !== null && !isNaN(budgetMin);
  const hasMax = budgetMax !== undefined && budgetMax !== null && !isNaN(budgetMax);

  // buyer didn't set a budget preference at all — don't penalize for it
  if (!hasMin && !hasMax) return 1;

  const min = hasMin ? Number(budgetMin) : 0;
  const max = hasMax ? Number(budgetMax) : Infinity;

  if (price >= min && price <= max) return 1;

  const distance = price < min ? min - price : price - max;
  // use the range size itself as the "how far is too far" yardstick, with
  // a sane floor so a razor-thin budget range doesn't make everything
  // score near zero
  const range = Math.max(max - min, min || 500000);
  const overshoot = distance / range;

  return Math.max(0, 1 - overshoot);
};


const scoreLocationMatch = (propertyLocation, preferredLocation) => {
  if (!preferredLocation) return 1;

  const loc = (propertyLocation || '').toLowerCase();
  const pref = preferredLocation.toLowerCase();

  if (loc.includes(pref) || pref.includes(loc)) return 1;

  const prefWords = pref.split(/[\s,]+/).filter(Boolean);
  const locWords = loc.split(/[\s,]+/).filter(Boolean);
  const sharesAWord = prefWords.some((word) => locWords.includes(word));

  if (sharesAWord) return 0.5;

  return 0.15;
};

const scoreLotSizeMatch = (propertyLotSize, minLotSize) => {
  const min = Number(minLotSize) || 0;
  if (min <= 0) return 1;

  const size = Number(propertyLotSize) || 0;
  if (size >= min) return 1;

  return Math.max(0, size / min);
};

export const getBuyerRecommendations = async (userId) => {
  // 1. Fetch saved preferences for the logged-in buyer using 'userId'
  const preferences = await BuyerPreference.findOne({ userId: userId });

  if (!preferences) {
    throw new AppError('Buyer preferences not found.', 404);
  }

  const hardFilter = {
    status: 'Available',
  };

  if (preferences.landType) {
    hardFilter.type = preferences.landType;
  }

  const candidates = await Property.find(hardFilter);

  const scored = candidates.map((property) => {
    const budgetScore = scoreBudgetMatch(
      property.price,
      preferences.budgetMin,
      preferences.budgetMax
    );
    const locationScore = scoreLocationMatch(property.location, preferences.location);
    const lotSizeScore = scoreLotSizeMatch(property.lotSize, preferences.minLotSize);

    const totalScore = budgetScore * 0.4 + locationScore * 0.35 + lotSizeScore * 0.25;

    return { property, totalScore };
  });

  // Best matches first; ties broken by newest listing, same as before.
  scored.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    return new Date(b.property.createdAt) - new Date(a.property.createdAt);
  });

  const recommendedProperties = scored.map((entry) => entry.property);

  return {
    preferences,
    totalMatches: recommendedProperties.length,
    properties: recommendedProperties,
  };
};