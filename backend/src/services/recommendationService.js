import BuyerPreference from '../models/BuyerPreference.js';
import Property from '../models/Property.js';
import AppError from '../utils/errors.js';
import { toPublicProperties } from '../utils/publicPropertyView.js';
import { expandBuyerPropertyTypeFilter } from '../../../shared/propertyCategories.mjs';

const MINIMUM_ONLY_BUDGET_RANGE = 500_000;

const scoreBudgetMatch = (price, budgetMin, budgetMax) => {
  const hasMin = budgetMin !== undefined && budgetMin !== null && !isNaN(budgetMin);
  const hasMax = budgetMax !== undefined && budgetMax !== null && !isNaN(budgetMax);

  // buyer didn't set a budget preference at all — don't penalize for it
  if (!hasMin && !hasMax) return 1;

  const min = hasMin ? Number(budgetMin) : 0;
  const isMinimumOnly = hasMin && !hasMax;
  const max = hasMax
    ? Number(budgetMax)
    : isMinimumOnly
      ? min + MINIMUM_ONLY_BUDGET_RANGE
      : Infinity;

  if (price >= min && price <= max) return 1;

  const distance = price < min ? min - price : price - max;
  // use the range size itself as the "how far is too far" yardstick, with
  // a sane floor so a razor-thin budget range doesn't make everything
  // score near zero
  const range = isMinimumOnly
    ? MINIMUM_ONLY_BUDGET_RANGE
    : Math.max(max - min, min || 500000);
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

// Exact-match only, never a hard filter. Missing data on either side
// (buyer intendedUse, or property suitableFor) simply scores 0 — the
// property still stays in the results, it just doesn't get the intended-use
// bonus. No AI/guessing involved, purely a direct value comparison.
const scoreIntendedUseMatch = (suitableFor, intendedUse) => {
  if (!intendedUse) return 0;
  if (!Array.isArray(suitableFor) || suitableFor.length === 0) return 0;
  return suitableFor.includes(intendedUse) ? 1 : 0;
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
    const matchedTypes = expandBuyerPropertyTypeFilter(preferences.landType);
    hardFilter.type = matchedTypes.length > 1 ? { $in: matchedTypes } : matchedTypes[0];
  }

  const candidates = await Property.find(hardFilter);

  const validCandidates = candidates.filter((property) =>
    typeof property.price === 'number' &&
    Number.isFinite(property.price) &&
    typeof property.location === 'string' &&
    property.location.trim().length > 0
  );

  const scored = validCandidates.map((property) => {
    const budgetScore = scoreBudgetMatch(
      property.price,
      preferences.budgetMin,
      preferences.budgetMax
    );
    const locationScore = scoreLocationMatch(property.location, preferences.location);
    const lotSizeScore = scoreLotSizeMatch(property.lotSize, preferences.minLotSize);
    const intendedUseScore = scoreIntendedUseMatch(property.suitableFor, preferences.intendedUse);

    const totalScore =
      budgetScore * 0.35 +
      locationScore * 0.3 +
      lotSizeScore * 0.2 +
      intendedUseScore * 0.15;

    return { property, totalScore };
  });

  // Best matches first; ties are broken by newest listing, then stable property ID.
  scored.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    const newestFirst = new Date(b.property.createdAt) - new Date(a.property.createdAt);
    if (Number.isFinite(newestFirst) && newestFirst !== 0) return newestFirst;
    const idA = String(a.property._id);
    const idB = String(b.property._id);
    return idA < idB ? -1 : idA > idB ? 1 : 0;
  });

  const recommendedProperties = toPublicProperties(scored.map((entry) => entry.property));

  return {
    preferences,
    totalMatches: recommendedProperties.length,
    properties: recommendedProperties,
  };
};
