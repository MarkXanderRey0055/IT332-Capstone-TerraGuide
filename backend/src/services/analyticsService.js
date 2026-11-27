import Property from '../models/Property.js';
import User from '../models/User.js';
import BuyerPreference from '../models/BuyerPreference.js';
import Audit from '../models/Audit.js';
import Transaction from '../models/Transaction.js';
import SearchEvent from '../models/SearchEvent.js';
import Inquiry from '../models/Inquiry.js';
import SiteVisit from '../models/SiteVisit.js';
import AppError from '../utils/errors.js';
import { getStartOfManilaMonth, getManilaYearBounds } from '../utils/manilaTime.js';
import { generatePortfolioNarrative } from './aiService.js';
import { computeRiskLevel } from '../utils/auditReadiness.js';
import { buildPortfolioActions } from '../utils/portfolioRules.js';
import { evaluateTypeDecisions } from '../utils/typeDecisionRules.js';
import { BUYER_VISIBLE_PROPERTY_STATUS, isBuyerVisibleStatus } from '../../../shared/propertyVisibility.mjs';
import { findBatangasTown } from '../../../shared/batangasTownCenters.mjs';

const COMPLIANCE_READY_THRESHOLD = 70;
export const SEARCH_METRIC_MIN_SAMPLE = 5;
export const SEARCH_WINDOW_DAYS = 30;
export const PROPERTY_TYPE_OPTIONS = ['Residential', 'House & Lot', 'Agricultural', 'Commercial', 'Condominium'];
export const SEARCH_PRICE_BUCKETS = [
  { label: 'Under ₱1M', min: -Infinity, max: 1000000 },
  { label: '₱1M–₱2M', min: 1000000, max: 2000000 },
  { label: '₱2M–₱4M', min: 2000000, max: 4000000 },
  { label: '₱4M–₱6M', min: 4000000, max: 6000000 },
  { label: 'Over ₱6M', min: 6000000, max: Infinity },
];
async function getLatestAuditsByProperty() {
  const latest = await Audit.aggregate([
    { $sort: { generatedAt: -1 } },
    { $group: { _id: '$propertyId', audit: { $first: '$$ROOT' } } },
  ]);

  const map = new Map();
  latest.forEach((entry) => {
    map.set(entry._id.toString(), entry.audit);
  });
  return map;
}

export function calculatePriceCompetitiveness(price, peerPrices) {
  const peers = peerPrices.filter((value) => Number.isFinite(value) && value > 0);
  if (!Number.isFinite(price) || price <= 0 || peers.length === 0) {
    return { score: 50, neutral: true, peerAverage: null };
  }
  const peerAverage = peers.reduce((sum, value) => sum + value, 0) / peers.length;
  return {
    score: Math.max(0, Math.min(100, Math.round((peerAverage / price) * 100))),
    neutral: false,
    peerAverage,
  };
}

export function calculateMarketReadinessScore(complianceScore, priceScore) {
  return Math.round(complianceScore * 0.6 + priceScore * 0.4);
}

function computeSuccessRatePercentile(score, allScores) {
  if (allScores.length <= 1) return 100;

  const countBelow = allScores.filter((s) => s < score).length;
  const countEqual = allScores.filter((s) => s === score).length;

  return Math.round(((countBelow + countEqual / 2) / allScores.length) * 100);
}


export async function getDashboardSummary() {
  const startOfMonth = getStartOfManilaMonth();

  const [
    totalProperties,
    availableProperties,
    reservedProperties,
    soldProperties,
    totalBuyers,
    propertiesAddedThisMonth,
    buyersRegisteredThisMonth,
    allProperties,
    latestAudits,
  ] = await Promise.all([
    Property.countDocuments(),
    Property.countDocuments({ status: 'Available' }),
    Property.countDocuments({ status: 'Reserved' }),
    Property.countDocuments({ status: 'Sold' }),
    User.countDocuments({ role: 'buyer' }),
    Property.countDocuments({ createdAt: { $gte: startOfMonth } }),
    User.countDocuments({ role: 'buyer', createdAt: { $gte: startOfMonth } }),
    Property.find().select('price'),
    getLatestAuditsByProperty(),
  ]);

  const complianceScores = Array.from(latestAudits.values()).map(
    (audit) => audit.complianceScore
  );

  const averageComplianceScore =
    complianceScores.length > 0
      ? Math.round(
          complianceScores.reduce((sum, score) => sum + score, 0) /
            complianceScores.length
        )
      : 0;

  
  const readyCount = complianceScores.filter(
    (score) => score >= COMPLIANCE_READY_THRESHOLD
  ).length;
  const averageSuccessRate =
    complianceScores.length > 0
      ? Math.round((readyCount / complianceScores.length) * 100)
      : 0;

  const estimatedPortfolioValue = allProperties.reduce(
    (sum, property) => sum + property.price,
    0
  );

  const highRiskListingsCount = allProperties.filter((property) => {
    const audit = latestAudits.get(property._id.toString());
    return computeRiskLevel(audit) === 'High';
  }).length;

  return {
    totalProperties,
    availableProperties,
    reservedProperties,
    soldProperties,
    totalBuyers,
    propertiesAddedThisMonth,
    buyersRegisteredThisMonth,
    averageComplianceScore,
    averageSuccessRate,
    estimatedPortfolioValue,
    highRiskListingsCount,
    
    auditedPropertiesCount: complianceScores.length,
  };
}

export async function getChartData() {
  const [statusAgg, typeAgg, latestAudits] = await Promise.all([
    Property.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Property.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }]),
    getLatestAuditsByProperty(),
  ]);

  const toChartPoints = (aggregationResult) =>
    aggregationResult.map((entry) => ({
      label: entry._id || 'Unspecified',
      count: entry.count,
    }));

  const complianceScores = Array.from(latestAudits.values()).map(
    (audit) => audit.complianceScore
  );

  const scoreBuckets = [
    { label: '0-20%', min: 0, max: 20 },
    { label: '21-40%', min: 21, max: 40 },
    { label: '41-60%', min: 41, max: 60 },
    { label: '61-80%', min: 61, max: 80 },
    { label: '81-100%', min: 81, max: 100 },
  ];

  const complianceScoreDistribution = scoreBuckets.map((bucket) => ({
    label: bucket.label,
    count: complianceScores.filter(
      (score) => score >= bucket.min && score <= bucket.max
    ).length,
  }));

  return {
    propertyStatusDistribution: toChartPoints(statusAgg),
    propertyTypeDistribution: toChartPoints(typeAgg),
    complianceScoreDistribution,
  };
}

export async function getTopProperties(limit = 5) {
  const latestAudits = await getLatestAuditsByProperty();

  const ranked = Array.from(latestAudits.entries()).sort(
    (a, b) => b[1].complianceScore - a[1].complianceScore
  );

  const topEntries = ranked.slice(0, limit);
  const propertyIds = topEntries.map(([propertyId]) => propertyId);

  const properties = await Property.find({ _id: { $in: propertyIds } });
  const propertyById = new Map(
    properties.map((property) => [property._id.toString(), property])
  );

  return topEntries
    .map(([propertyId, audit]) => {
      const property = propertyById.get(propertyId);
      if (!property) return null;

      return {
        propertyId,
        name: property.name,
        type: property.type,
        location: property.location,
        status: property.status,
        complianceScore: audit.complianceScore,
        auditedAt: audit.generatedAt,
      };
    })
    .filter(Boolean);
}


export async function getAttentionProperties() {
  const [allProperties, latestAudits] = await Promise.all([
    Property.find(),
    getLatestAuditsByProperty(),
  ]);

  const flagged = [];

  for (const property of allProperties.filter((entry) => isBuyerVisibleStatus(entry.status))) {
    const audit = latestAudits.get(property._id.toString());
    const reasons = [];

    if (!audit) {
      reasons.push('Not yet audited');
    } else {
      if (audit.complianceScore < COMPLIANCE_READY_THRESHOLD) {
        reasons.push(`Low compliance score (${audit.complianceScore}%)`);
      }
      if (audit.missingItems && audit.missingItems.length > 0) {
        reasons.push(`Missing: ${audit.missingItems.join(', ')}`);
      }
    }

    if (reasons.length > 0) {
      flagged.push({
        propertyId: property._id.toString(),
        name: property.name,
        type: property.type,
        location: property.location,
        status: property.status,
        complianceScore: audit ? audit.complianceScore : null,
        riskLevel: computeRiskLevel(audit),
        reasons,
      });
    }
  }

  flagged.sort((a, b) => (a.complianceScore ?? -1) - (b.complianceScore ?? -1));

  return flagged;
}

export async function getPropertyRankings({ availableOnly = false, useComparablePricing = false } = {}) {
  let availableListingsRequest = Promise.resolve([]);
  if (useComparablePricing) {
    const availableListingsQuery = Property.find({ status: BUYER_VISIBLE_PROPERTY_STATUS });
    availableListingsRequest = typeof availableListingsQuery.select === 'function'
      ? availableListingsQuery.select('type price')
      : availableListingsQuery;
  }
  const [properties, latestAudits, availableListings] = await Promise.all([
    Property.find(availableOnly ? { status: BUYER_VISIBLE_PROPERTY_STATUS } : {}),
    getLatestAuditsByProperty(),
    availableListingsRequest,
  ]);

  const availableByType = new Map();
  availableListings.forEach((listing) => {
    if (!availableByType.has(listing.type)) availableByType.set(listing.type, []);
    availableByType.get(listing.type).push(listing);
  });

  const auditedEntries = properties
    .map((property) => {
      const audit = latestAudits.get(property._id.toString());
      return audit ? { property, audit } : null;
    })
    .filter(Boolean);

  const allScores = auditedEntries.map((entry) => entry.audit.complianceScore);

  const rankings = auditedEntries
    .map(({ property, audit }) => {
      const peers = (availableByType.get(property.type) ?? [])
        .filter((candidate) => candidate._id.toString() !== property._id.toString())
        .map((candidate) => candidate.price);
      const price = calculatePriceCompetitiveness(property.price, peers);
      return {
        propertyId: property._id.toString(),
        name: property.name,
        type: property.type,
        location: property.location,
        status: property.status,
        complianceScore: audit.complianceScore,
        successRate: computeSuccessRatePercentile(audit.complianceScore, allScores),
        marketReadinessScore: useComparablePricing
          ? calculateMarketReadinessScore(audit.complianceScore, price.score)
          : Math.round(audit.complianceScore * 0.6 + 50 * 0.4),
        priceCompetitivenessScore: useComparablePricing ? price.score : 50,
        priceComparison: useComparablePricing && price.neutral ? 'neutral: no comparable listings' : null,
        riskLevel: computeRiskLevel(audit),
      };
    })
    .sort((a, b) => b.marketReadinessScore - a.marketReadinessScore)
    .map((entry, index) => ({ rank: index + 1, ...entry }));

  return {
    rankings,
    unauditedCount: properties.length - auditedEntries.length,
  };
}

export async function getBuyerIntelligence() {
  const buyers = await User.find({ role: 'buyer' }, { _id: 1 });
  const buyerIds = buyers.map((buyer) => buyer._id);

  if (buyerIds.length === 0) {
    return {
      budgetDistribution: [],
      preferredTypes: [],
      preferredLocations: [],
      averageBudget: 0,
      totalBuyersWithPreferences: 0,
      buyersWithBothBudgetBounds: 0,
    };
  }

  const preferences = await BuyerPreference.find({ userId: { $in: buyerIds } });

  if (preferences.length === 0) {
    return {
      budgetDistribution: [],
      preferredTypes: [],
      preferredLocations: [],
      averageBudget: 0,
      totalBuyersWithPreferences: 0,
      buyersWithBothBudgetBounds: 0,
    };
  }

  const midpoints = preferences.map((pref) => (pref.budgetMin + pref.budgetMax) / 2);

  const budgetBuckets = [
    { label: 'Under ₱1M', min: 0, max: 1000000 },
    { label: '₱1M - ₱2M', min: 1000000, max: 2000000 },
    { label: '₱2M - ₱4M', min: 2000000, max: 4000000 },
    { label: '₱4M - ₱6M', min: 4000000, max: 6000000 },
    { label: 'Over ₱6M', min: 6000000, max: Infinity },
  ];

  const budgetDistribution = budgetBuckets.map((bucket) => ({
    label: bucket.label,
    count: midpoints.filter((mid) => mid >= bucket.min && mid < bucket.max).length,
  }));

  const typeCounts = {};
  const locationCounts = {};

  preferences.forEach((pref) => {
    if (pref.landType) {
      typeCounts[pref.landType] = (typeCounts[pref.landType] || 0) + 1;
    }
    if (pref.location) {
      locationCounts[pref.location] = (locationCounts[pref.location] || 0) + 1;
    }
  });

  const preferredTypes = Object.entries(typeCounts).map(([label, count]) => ({
    label,
    count,
  }));

  const preferredLocations = Object.entries(locationCounts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  const validBudgetMidpoints = preferences
    .filter(
      (pref) =>
        typeof pref.budgetMin === 'number' &&
        Number.isFinite(pref.budgetMin) &&
        pref.budgetMin > 0 &&
        typeof pref.budgetMax === 'number' &&
        Number.isFinite(pref.budgetMax) &&
        pref.budgetMax > 0 &&
        pref.budgetMin <= pref.budgetMax
    )
    .map((pref) => (pref.budgetMin + pref.budgetMax) / 2);

  const buyersWithBothBudgetBounds = validBudgetMidpoints.length;
  const averageBudget =
    validBudgetMidpoints.length > 0
      ? Math.round(
          validBudgetMidpoints.reduce((sum, mid) => sum + mid, 0) /
            validBudgetMidpoints.length
        )
      : 0;

  return {
    budgetDistribution,
    preferredTypes,
    preferredLocations,
    averageBudget,
    totalBuyersWithPreferences: preferences.length,
    buyersWithBothBudgetBounds,
  };
}

export async function getSalesPerformance() {
  const { start, end } = getManilaYearBounds();

  const [completedTransactions, ytdAgg] = await Promise.all([
    Transaction.find({ status: 'Completed' }).select('amount completedAt updatedAt createdAt'),
    Transaction.aggregate([
      { $match: { status: 'Completed', completedAt: { $gte: start, $lt: end } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);

  const revenueYTD = ytdAgg[0]?.total || 0;

  if (completedTransactions.length === 0) {
    return {
      monthlyTrend: [],
      totalRevenue: 0,
      monthlyAverage: 0,
      forecastNextMonth: 0,
      isApproximate: false,
      note: '',
      revenueYTD,
      revenueYTDSource: 'transactions',
    };
  }

  let hasUnrecordedCompletionDates = false;
  const monthlyTotals = new Map();

  completedTransactions.forEach((txn) => {
    let date = txn.completedAt;
    if (!date) {
      hasUnrecordedCompletionDates = true;
      date = txn.updatedAt || txn.createdAt;
    }
    const d = new Date(date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyTotals.set(key, (monthlyTotals.get(key) || 0) + (txn.amount || 0));
  });

  const monthlyTrend = Array.from(monthlyTotals.entries())
    .sort(([a], [b]) => (a > b ? 1 : -1))
    .map(([month, total]) => ({ month, total }));

  const totalRevenue = completedTransactions.reduce(
    (sum, txn) => sum + (txn.amount || 0),
    0
  );
  const monthlyAverage =
    monthlyTrend.length > 0 ? Math.round(totalRevenue / monthlyTrend.length) : 0;

  const recentMonths = monthlyTrend.slice(-3);
  const forecastNextMonth =
    recentMonths.length > 0
      ? Math.round(
          recentMonths.reduce((sum, month) => sum + month.total, 0) /
            recentMonths.length
        )
      : 0;

  const isApproximate = hasUnrecordedCompletionDates;
  const note = isApproximate
    ? 'Some completed transactions lack an explicit completion timestamp and use their record update date.'
    : '';

  return {
    monthlyTrend,
    totalRevenue,
    monthlyAverage,
    forecastNextMonth,
    isApproximate,
    note,
    revenueYTD,
    revenueYTDSource: 'transactions',
  };
}

export async function getPortfolioSnapshot() {
  const [summary, rankingsResult, buyerIntelligence, salesPerformance] = await Promise.all([
    getDashboardSummary(),
    getPropertyRankings(),
    getBuyerIntelligence(),
    getSalesPerformance(),
  ]);

  const riskCounts = rankingsResult.rankings.reduce(
    (acc, entry) => {
      acc[entry.riskLevel] = (acc[entry.riskLevel] || 0) + 1;
      return acc;
    },
    { High: 0, Medium: 0, Low: 0 }
  );
  
  riskCounts.NotAudited = rankingsResult.unauditedCount;

  const topPreferredType =
    [...buyerIntelligence.preferredTypes].sort((a, b) => b.count - a.count)[0]?.label ?? null;
  const topPreferredLocation = buyerIntelligence.preferredLocations[0]?.label ?? null;

  return {
    summary,
    riskCounts,
    buyerIntelligence: {
      topPreferredType,
      topPreferredLocation,
      averageBudget: buyerIntelligence.averageBudget,
      totalBuyersWithPreferences: buyerIntelligence.totalBuyersWithPreferences,
    },
    salesPerformance,
  };
}

export async function generatePortfolioInsights() {
  const snapshot = await getPortfolioSnapshot();
  try {
    const insights = await generatePortfolioNarrative(snapshot);
    return createPortfolioInsightResult(snapshot, insights);
  } catch (error) {
    if (
      error?.code === 'AI_CONFIGURATION_ERROR' ||
      error?.aiCategory === 'configuration' ||
      error?.statusCode === 401 ||
      error?.statusCode === 403 ||
      error?.providerStatus === 401 ||
      error?.providerStatus === 403
    ) {
      throw error;
    }

    return createPortfolioFallbackResult(snapshot, error);
  }
}

export function createPortfolioInsightResult(snapshot, insights) {
  return { snapshot, insights, narrativeOrigin: 'AI_GENERATED', fallbackReason: null };
}

export function createPortfolioFallbackResult(snapshot, error) {
  return {
    snapshot,
    insights: createDeterministicPortfolioInsights(snapshot),
    narrativeOrigin: 'SYSTEM_FALLBACK',
    fallbackReason: getPortfolioFallbackReason(error),
  };
}

const PORTFOLIO_INSIGHT_FIELDS = [
  'portfolioHealth',
  'marketTrends',
  'buyerBehavior',
  'topPerformingCategories',
  'risks',
  'recommendations',
];

function count(value) {
  return Number.isFinite(value) ? value : 0;
}

function peso(value) {
  return `₱${count(value).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;
}

export function createDeterministicPortfolioInsights(snapshot) {
  const { summary, riskCounts, buyerIntelligence, salesPerformance } = snapshot;
  const insights = {
    portfolioHealth: `The portfolio contains ${count(summary.totalProperties)} properties: ${count(summary.availableProperties)} available, ${count(summary.reservedProperties)} reserved, and ${count(summary.soldProperties)} sold. Its estimated recorded value is ${peso(summary.estimatedPortfolioValue)}, alongside ${count(summary.totalBuyers)} registered buyers. The recorded average compliance score is ${count(summary.averageComplianceScore)}% across ${count(summary.auditedPropertiesCount)} audited properties.`,
    marketTrends: `Recorded transaction revenue is ${peso(salesPerformance.totalRevenue)}, with a reported monthly average of ${peso(salesPerformance.monthlyAverage)} and a snapshot projection of ${peso(salesPerformance.forecastNextMonth)} for the next month. ${salesPerformance.note || 'These figures reflect the sales data available in this portfolio snapshot.'}`,
    buyerBehavior: `The snapshot records ${count(buyerIntelligence.totalBuyersWithPreferences)} buyers with preferences${buyerIntelligence.topPreferredType ? `; the most recorded property type preference is ${buyerIntelligence.topPreferredType}` : '; no top property type preference is recorded'}. ${buyerIntelligence.topPreferredLocation ? `The most recorded location preference is ${buyerIntelligence.topPreferredLocation}.` : 'No top location preference is recorded.'} Average stated budget is ${peso(buyerIntelligence.averageBudget)}.`,
    topPerformingCategories: `This snapshot does not include category-level performance comparisons, so it cannot identify a top-performing property type. Across audited properties, the recorded average compliance score is ${count(summary.averageComplianceScore)}%, based on ${count(summary.auditedPropertiesCount)} audits.`,
    risks: `The recorded risk breakdown is ${count(riskCounts.High)} high, ${count(riskCounts.Medium)} medium, and ${count(riskCounts.Low)} low-risk properties, with ${count(riskCounts.NotAudited)} properties not yet audited. These counts identify the current groups represented in the portfolio snapshot.`,
    recommendations: `Review the ${count(riskCounts.NotAudited)} properties not yet audited and prioritize administrative follow-up for the ${count(riskCounts.High)} listings classified as high risk. Use the recorded buyer preferences${buyerIntelligence.topPreferredType ? `, including ${buyerIntelligence.topPreferredType}` : ''}${buyerIntelligence.topPreferredLocation ? ` and ${buyerIntelligence.topPreferredLocation}` : ''} as context when reviewing portfolio activity.`,
  };
  return Object.fromEntries(PORTFOLIO_INSIGHT_FIELDS.map((field) => [field, insights[field]]));
}

export function getPortfolioFallbackReason(error) {
  if (error?.code === 'AI_TIMEOUT' || error?.aiCategory === 'timeout') return 'AI_TIMEOUT';
  if (
    error?.code === 'AI_INVALID_RESPONSE' ||
    error?.code === 'AI_CONTRADICTORY_RESPONSE' ||
    error?.aiCategory === 'json' ||
    error?.aiCategory === 'validation' ||
    error instanceof SyntaxError
  ) return 'AI_INVALID_RESPONSE';
  return 'AI_UNAVAILABLE';
}


export async function getBuyerMarketTrends(limit = 5, { includeAllTypes = false, useComparablePricing = false } = {}) {
  const [buyerIntelligence, rankingsResult] = await Promise.all([
    getBuyerIntelligence(),
    getPropertyRankings({ availableOnly: true, useComparablePricing }),
  ]);

  const preferenceCounts = new Map(buyerIntelligence.preferredTypes.map((entry) => [entry.label, entry.count]));
  const preferenceTypes = includeAllTypes
    ? PROPERTY_TYPE_OPTIONS.map((label) => ({ label, count: preferenceCounts.get(label) ?? 0 }))
    : buyerIntelligence.preferredTypes;
  const totalPreferenceVotes = preferenceTypes.reduce(
    (sum, entry) => sum + entry.count,
    0
  );

  const trendingTypes =
    totalPreferenceVotes > 0
      ? preferenceTypes
          .map((entry) => ({
            type: entry.label,
            percentage: Math.round((entry.count / totalPreferenceVotes) * 100),
          }))
          .sort((a, b) => b.percentage - a.percentage)
      : includeAllTypes
        ? PROPERTY_TYPE_OPTIONS.map((type) => ({ type, percentage: 0 }))
        : [];

  const topListings = rankingsResult.rankings.slice(0, limit).map((entry) => ({
    rank: entry.rank,
    propertyId: entry.propertyId,
    name: entry.name,
    type: entry.type,
    location: entry.location,
    status: entry.status,
    marketScore: entry.marketReadinessScore,
    ...(entry.priceComparison ? { priceComparison: entry.priceComparison } : {}),
  }));

  return {
    trendingTypes,
    topListings,
    totalBuyersWithPreferences: buyerIntelligence.totalBuyersWithPreferences,
  };
}

export function summarizeSearchEvents(events, now = new Date()) {
  const windowStart = new Date(now.getTime() - SEARCH_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const recent = events.filter((event) => new Date(event.createdAt) >= windowStart && new Date(event.createdAt) <= now);
  const typeEvents = recent.filter((event) => typeof event.propertyType === 'string' && event.propertyType.trim());
  const locationEvents = recent.filter((event) => typeof event.location === 'string' && event.location.trim());
  const boundedPriceEvents = recent.filter((event) => Number.isFinite(event.minPrice) && Number.isFinite(event.maxPrice));

  const countBy = (items, keyFn) => {
    const counts = new Map();
    items.forEach((item) => {
      const key = keyFn(item);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
  };
  const typeCounts = countBy(typeEvents, (event) => event.propertyType);
  const locationCounts = countBy(locationEvents, (event) => {
    const trimmedLocation = event.location.trim();
    return findBatangasTown(trimmedLocation)?.name ?? trimmedLocation;
  });
  const priceCounts = countBy(boundedPriceEvents, (event) => {
    const midpoint = (event.minPrice + event.maxPrice) / 2;
    if (midpoint < 1000000) return SEARCH_PRICE_BUCKETS[0].label;
    if (midpoint < 2000000) return SEARCH_PRICE_BUCKETS[1].label;
    if (midpoint < 4000000) return SEARCH_PRICE_BUCKETS[2].label;
    if (midpoint <= 6000000) return SEARCH_PRICE_BUCKETS[3].label;
    return SEARCH_PRICE_BUCKETS[4].label;
  });
  const withMetric = (items, denominator) => ({
    eligibleSearches: denominator,
    enoughSearches: denominator >= SEARCH_METRIC_MIN_SAMPLE,
    smallSample: denominator >= SEARCH_METRIC_MIN_SAMPLE && denominator < SEARCH_METRIC_MIN_SAMPLE * 2,
    items,
  });

  return {
    totalSearches: recent.length,
    windowStart,
    threshold: SEARCH_METRIC_MIN_SAMPLE,
    propertyTypes: withMetric(PROPERTY_TYPE_OPTIONS.map((type) => ({ type, count: typeCounts.get(type) ?? 0 })), typeEvents.length),
    popularLocations: withMetric([...locationCounts].map(([location, count]) => ({ location, count })).sort((a, b) => b.count - a.count || a.location.localeCompare(b.location)), locationEvents.length),
    priceRanges: withMetric(SEARCH_PRICE_BUCKETS.map(({ label }) => ({ range: label, count: priceCounts.get(label) ?? 0 })), boundedPriceEvents.length),
  };
}

export async function getBuyerSearchMetrics(now = new Date()) {
  const windowStart = new Date(now.getTime() - SEARCH_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const events = await SearchEvent.find({ createdAt: { $gte: windowStart, $lte: now } })
    .select('propertyType location minPrice maxPrice createdAt')
    .lean();
  return summarizeSearchEvents(events, now);
}

export async function getTypeDecisionSnapshot(referenceDate) {
  const buyers = await User.find({ role: 'buyer' }, { _id: 1 });
  const buyerIds = buyers.map((buyer) => buyer._id);

  const [preferences, availableListings, latestAuditByPropertyId, pendingInquiries, pendingSiteVisits] =
    await Promise.all([
      BuyerPreference.find({ userId: { $in: buyerIds } }, { userId: 1, landType: 1 }),
      Property.find({ status: 'Available' }, { _id: 1, name: 1, type: 1, price: 1, status: 1 }),
      getLatestAuditsByProperty(),
      Inquiry.find({ status: 'Pending' }, { _id: 1, propertyId: 1, createdAt: 1, status: 1 }),
      SiteVisit.find({ status: 'Pending' }, { _id: 1, propertyId: 1, preferredDate: 1, status: 1 }),
    ]);

  const buyersByLandType = new Map();
  let nullDemandCount = 0;
  for (const pref of preferences) {
    if (pref.landType === null || pref.landType === undefined) {
      nullDemandCount += 1;
      continue;
    }
    if (!buyersByLandType.has(pref.landType)) {
      buyersByLandType.set(pref.landType, new Set());
    }
    buyersByLandType.get(pref.landType).add(String(pref.userId));
  }

  const demandByType = {};
  for (const [landType, buyerSet] of buyersByLandType.entries()) {
    demandByType[landType] = buyerSet.size;
  }

  const pricedAvailableListings = availableListings.filter(
    (listing) =>
      listing?.status === 'Available' &&
      typeof listing.price === 'number' &&
      Number.isFinite(listing.price) &&
      listing.price > 0
  );

  const supplyByType = {};
  const propertyNameById = new Map();
  for (const listing of pricedAvailableListings) {
    const type = listing.type;
    if (!supplyByType[type]) {
      supplyByType[type] = { listings: 0, low: 0, medium: 0, high: 0, notAudited: 0 };
    }
    supplyByType[type].listings += 1;

    const propertyId = String(listing._id);
    propertyNameById.set(propertyId, listing.name);

    const audit = latestAuditByPropertyId.get(propertyId);
    const riskLevel = computeRiskLevel(audit);
    if (riskLevel === 'Low') supplyByType[type].low += 1;
    else if (riskLevel === 'Medium') supplyByType[type].medium += 1;
    else if (riskLevel === 'High') supplyByType[type].high += 1;
    else supplyByType[type].notAudited += 1;
  }

  const typeDecisions = evaluateTypeDecisions({
    supplyByType,
    demandByType,
    nullDemandCount,
  });

  const operationalActions = buildPortfolioActions({
    listings: pricedAvailableListings,
    latestAuditByPropertyId,
    inquiries: pendingInquiries,
    siteVisits: pendingSiteVisits,
    propertyNameById,
    referenceDate,
  });

  return {
    referenceDate: operationalActions.referenceDate,
    typeDecisions,
    operationalActions,
  };
}
