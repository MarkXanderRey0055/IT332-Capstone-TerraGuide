import Property from '../models/Property.js';
import User from '../models/User.js';
import BuyerPreference from '../models/BuyerPreference.js';
import Audit from '../models/Audit.js';

// A property counts as "ready" once its latest audit clears this bar.
// Used for the success-rate KPI and for flagging low-compliance listings
// under "Properties Requiring Attention".
const COMPLIANCE_READY_THRESHOLD = 70;

// Audits pile up over time (we never overwrite old ones), so anywhere we
// need "the current state" of a property's compliance, we only care about
// its most recent audit. This grabs exactly that — one audit per
// propertyId, whichever has the newest generatedAt — and hands it back as
// a Map so the rest of this file can just look things up by id instead of
// re-running the aggregation every time.
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

// Powers the KPI cards at the top of the Analytics page.
export async function getDashboardSummary() {
  const [
    totalProperties,
    availableProperties,
    reservedProperties,
    soldProperties,
    totalBuyers,
    allProperties,
    latestAudits,
  ] = await Promise.all([
    Property.countDocuments(),
    Property.countDocuments({ status: 'Available' }),
    Property.countDocuments({ status: 'Reserved' }),
    Property.countDocuments({ status: 'Sold' }),
    User.countDocuments({ role: 'buyer' }),
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

  // "Success rate" isn't a stored field anywhere — we're defining it here
  // as the share of audited properties that actually clear the readiness
  // bar, which is a real, distinct number from the plain average score.
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

  return {
    totalProperties,
    availableProperties,
    reservedProperties,
    soldProperties,
    totalBuyers,
    averageComplianceScore,
    averageSuccessRate,
    estimatedPortfolioValue,
    // handy for the frontend to know how many properties the compliance
    // numbers above are actually based on
    auditedPropertiesCount: complianceScores.length,
  };
}

// Powers the four charts. Everything here is already bucketed/counted —
// the frontend just hands these arrays straight to Chart.js.
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

// Highest-scoring properties by their latest audit. Only audited
// properties can appear here at all — nothing to rank without a score.
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

// Anything an admin should probably look at: never been audited, scoring
// below the readiness bar, or missing documents on its latest audit.
// Worst-off properties (or never-audited ones) surface first.
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
        reasons,
      });
    }
  }

  // never-audited properties (null score) and the lowest scores bubble
  // up first, since those need eyes on them soonest
  flagged.sort((a, b) => (a.complianceScore ?? -1) - (b.complianceScore ?? -1));

  return flagged;
}