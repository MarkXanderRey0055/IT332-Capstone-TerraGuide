import Property from '../models/Property.js';
import User from '../models/User.js';
import BuyerPreference from '../models/BuyerPreference.js';
import Audit from '../models/Audit.js';
import Transaction from '../models/Transaction.js';
import AppError from '../utils/errors.js';
import { getStartOfManilaMonth, getManilaYearBounds } from '../utils/manilaTime.js';
import { generatePortfolioNarrative, generateBuyerMarketNarrative } from './aiService.js';

const COMPLIANCE_READY_THRESHOLD = 70;
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

function computeRiskLevel(audit) {
  if (!audit) return 'High';

  const missingCount = audit.missingItems ? audit.missingItems.length : 0;

  if (audit.complianceScore < 40 || missingCount >= 2) return 'High';
  if (audit.complianceScore < COMPLIANCE_READY_THRESHOLD || missingCount >= 1) return 'Medium';
  return 'Low';
}

function computeMarketReadinessScore(property, audit) {
  const comparisonAverage = audit.comparisonAverage || 0;

  let priceCompetitivenessScore = 50; 
  if (comparisonAverage > 0) {
    const ratio = property.price / comparisonAverage;
    if (ratio <= 1) {
      priceCompetitivenessScore = 100;
    } else {
      const overshoot = ratio - 1;
      priceCompetitivenessScore = Math.max(0, 100 - overshoot * 200);
    }
  }

  return Math.round(audit.complianceScore * 0.6 + priceCompetitivenessScore * 0.4);
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
  const [statusAgg, typeAgg, preferredTypeAgg, latestAudits] = await Promise.all([
    Property.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Property.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }]),
    BuyerPreference.aggregate([{ $group: { _id: '$landType', count: { $sum: 1 } } }]),
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
    buyerPreferredTypes: toChartPoints(preferredTypeAgg),
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

  for (const property of allProperties) {
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

export async function getPropertyRankings() {
  const [properties, latestAudits] = await Promise.all([
    Property.find(),
    getLatestAuditsByProperty(),
  ]);

  const auditedEntries = properties
    .map((property) => {
      const audit = latestAudits.get(property._id.toString());
      return audit ? { property, audit } : null;
    })
    .filter(Boolean);

  const allScores = auditedEntries.map((entry) => entry.audit.complianceScore);

  const rankings = auditedEntries
    .map(({ property, audit }) => ({
      propertyId: property._id.toString(),
      name: property.name,
      type: property.type,
      location: property.location,
      status: property.status,
      complianceScore: audit.complianceScore,
      successRate: computeSuccessRatePercentile(audit.complianceScore, allScores),
      marketReadinessScore: computeMarketReadinessScore(property, audit),
      riskLevel: computeRiskLevel(audit),
    }))
    .sort((a, b) => b.marketReadinessScore - a.marketReadinessScore)
    .map((entry, index) => ({ rank: index + 1, ...entry }));

  return {
    rankings,
    unauditedCount: properties.length - auditedEntries.length,
  };
}

export async function getBuyerIntelligence() {
  const preferences = await BuyerPreference.find();

  if (preferences.length === 0) {
    return {
      budgetDistribution: [],
      preferredTypes: [],
      preferredLocations: [],
      averageBudget: 0,
      totalBuyersWithPreferences: 0,
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

  const averageBudget = Math.round(
    midpoints.reduce((sum, mid) => sum + mid, 0) / midpoints.length
  );

  return {
    budgetDistribution,
    preferredTypes,
    preferredLocations,
    averageBudget,
    totalBuyersWithPreferences: preferences.length,
  };
}

export async function getSalesPerformance() {
  const { start, end } = getManilaYearBounds();

  const [soldProperties, ytdAgg] = await Promise.all([
    Property.find({ status: 'Sold' }).select('price updatedAt'),
    Transaction.aggregate([
      { $match: { status: 'Completed', completedAt: { $gte: start, $lt: end } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);

  const revenueYTD = ytdAgg[0]?.total || 0;

  if (soldProperties.length === 0) {
    return {
      monthlyTrend: [],
      totalRevenue: 0,
      monthlyAverage: 0,
      forecastNextMonth: 0,
      isApproximate: true,
      note: "No properties are marked Sold yet, so there's no sales history to show.",
      revenueYTD,
      revenueYTDSource: 'transactions',
    };
  }

  const monthlyTotals = new Map();
  soldProperties.forEach((property) => {
    const date = new Date(property.updatedAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    monthlyTotals.set(key, (monthlyTotals.get(key) || 0) + property.price);
  });

  const monthlyTrend = Array.from(monthlyTotals.entries())
    .sort(([a], [b]) => (a > b ? 1 : -1))
    .map(([month, total]) => ({ month, total }));

  const totalRevenue = soldProperties.reduce((sum, property) => sum + property.price, 0);
  const monthlyAverage = Math.round(totalRevenue / monthlyTrend.length);

  const recentMonths = monthlyTrend.slice(-3);
  const forecastNextMonth = Math.round(
    recentMonths.reduce((sum, month) => sum + month.total, 0) / recentMonths.length
  );

  return {
    monthlyTrend,
    totalRevenue,
    monthlyAverage,
    forecastNextMonth,
    isApproximate: true,
    note:
      "Based on each property's last-updated date as a stand-in for its sale date, since the system doesn't record a dedicated sale date separately from general edits.",
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
  const insights = await generatePortfolioNarrative(snapshot);

  return { snapshot, insights };
}


export async function getBuyerMarketTrends(limit = 5) {
  const [buyerIntelligence, rankingsResult] = await Promise.all([
    getBuyerIntelligence(),
    getPropertyRankings(),
  ]);

  const totalPreferenceVotes = buyerIntelligence.preferredTypes.reduce(
    (sum, entry) => sum + entry.count,
    0
  );

  const trendingTypes =
    totalPreferenceVotes > 0
      ? buyerIntelligence.preferredTypes
          .map((entry) => ({
            type: entry.label,
            percentage: Math.round((entry.count / totalPreferenceVotes) * 100),
          }))
          .sort((a, b) => b.percentage - a.percentage)
      : [];

  const topListings = rankingsResult.rankings.slice(0, limit).map((entry) => ({
    rank: entry.rank,
    propertyId: entry.propertyId,
    name: entry.name,
    type: entry.type,
    location: entry.location,
    status: entry.status,
    marketScore: entry.marketReadinessScore,
  }));

  return {
    trendingTypes,
    topListings,
    totalBuyersWithPreferences: buyerIntelligence.totalBuyersWithPreferences,
  };
}

export async function getBuyerMarketSnapshot() {
  const [summary, marketTrends, buyerIntelligence] = await Promise.all([
    getDashboardSummary(),
    getBuyerMarketTrends(5),
    getBuyerIntelligence(),
  ]);

  const topPreferredLocation = buyerIntelligence.preferredLocations[0]?.label ?? null;

  return {
    totalProperties: summary.totalProperties,
    availableProperties: summary.availableProperties,
    totalBuyersWithPreferences: buyerIntelligence.totalBuyersWithPreferences,
    averageBudget: buyerIntelligence.averageBudget,
    topPreferredLocation,
    trendingTypes: marketTrends.trendingTypes,
    topListings: marketTrends.topListings,
  };
}

export async function generateBuyerMarketInsight() {
  const snapshot = await getBuyerMarketSnapshot();

  if (snapshot.totalProperties === 0) {
    throw new AppError(
      'Not enough listing data yet to generate a market insight.',
      400
    );
  }

  const insight = await generateBuyerMarketNarrative(snapshot);

  return { snapshot, insight };
}