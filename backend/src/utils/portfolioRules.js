import { classifyAuditRisk } from './auditReadiness.js';

// PROVISIONAL: pending confirmation from Smart Works.
export const UNANSWERED_INQUIRY_DAYS = 7;

// PROVISIONAL: uses existing High risk classification from classifyAuditRisk.
export const HIGH_RISK_LEVEL = 'High';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const ACTIVE_LISTING_STATUSES = new Set(['Available', 'Reserved']);

function toValidDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function lookupById(source, id) {
  if (!source || !id) return undefined;
  const key = String(id);
  if (source instanceof Map) return source.get(key);
  if (typeof source === 'object') return source[key];
  return undefined;
}

function extractId(value) {
  if (!value) return '';
  if (typeof value === 'object' && value !== null) {
    return String(value.id ?? value._id ?? '');
  }
  return String(value);
}

function formatIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function formatAsiaManilaDate(referenceDate) {
  const date = toValidDate(referenceDate) ?? new Date();
  const manilaWall = new Date(date.getTime() + MANILA_OFFSET_MS);
  return formatIsoDate(manilaWall);
}

export function buildAsiaManilaDayStart(referenceDate) {
  const date = toValidDate(referenceDate) ?? new Date();
  const manilaWall = new Date(date.getTime() + MANILA_OFFSET_MS);
  const manilaMidnightUtcMs =
    Date.UTC(
      manilaWall.getUTCFullYear(),
      manilaWall.getUTCMonth(),
      manilaWall.getUTCDate()
    ) - MANILA_OFFSET_MS;
  return new Date(manilaMidnightUtcMs);
}

export function evaluateHighRiskDocuments({
  listings = [],
  latestAuditByPropertyId = new Map(),
} = {}) {
  const keptListings = Array.isArray(listings)
    ? listings.filter((listing) => ACTIVE_LISTING_STATUSES.has(listing?.status))
    : [];

  let sampleSize = 0;
  const matches = [];

  for (const listing of keptListings) {
    const propertyId = extractId(listing);
    const audit = lookupById(latestAuditByPropertyId, propertyId);
    if (!audit) continue;

    sampleSize += 1;
    const score = audit.documentCompleteness ?? audit.complianceScore;
    const riskLevel = classifyAuditRisk(score);

    if (riskLevel === HIGH_RISK_LEVEL) {
      matches.push({
        propertyId,
        propertyName: listing.name || 'Unnamed listing',
        type: listing.type ?? '',
        status: listing.status,
        complianceScore: audit.complianceScore ?? score,
        riskLevel,
      });
    }
  }

  matches.sort((a, b) => {
    if (a.complianceScore !== b.complianceScore) {
      return a.complianceScore - b.complianceScore;
    }
    return a.propertyId.localeCompare(b.propertyId);
  });

  if (sampleSize === 0) {
    return {
      ruleId: 'HIGH_RISK_DOCUMENTS',
      fired: false,
      matchCount: 0,
      action:
        'No audited listings yet; run document readiness audits before evaluating high-risk listings.',
      evidence: [],
      sampleSize: 0,
    };
  }

  const fired = matches.length > 0;
  let action = '';
  if (matches.length === 1) {
    const first = matches[0];
    action = `Review document readiness for 1 high-risk listing (${first.propertyName}, ID ${first.propertyId}).`;
  } else if (matches.length > 1) {
    const first = matches[0];
    action = `Review document readiness for ${matches.length} high-risk listings, starting with ${first.propertyName} (ID ${first.propertyId}).`;
  }

  return {
    ruleId: 'HIGH_RISK_DOCUMENTS',
    fired,
    matchCount: matches.length,
    action,
    evidence: matches,
    sampleSize,
  };
}

export function evaluateStaleInquiries({
  inquiries = [],
  propertyNameById = new Map(),
  referenceDate = new Date(),
} = {}) {
  const refDate = toValidDate(referenceDate) ?? new Date();
  const cutoffMs = refDate.getTime() - UNANSWERED_INQUIRY_DAYS * MS_PER_DAY;
  const pending = Array.isArray(inquiries)
    ? inquiries.filter((inquiry) => inquiry?.status === 'Pending')
    : [];
  const sampleSize = pending.length;

  const matchedPairs = [];
  for (const inquiry of pending) {
    const createdDate = toValidDate(inquiry.createdAt);
    if (!createdDate || createdDate.getTime() >= cutoffMs) continue;

    const propertyId = extractId(inquiry.propertyId);
    const propertyName = lookupById(propertyNameById, propertyId) || 'Unavailable listing';
    const daysPending = Math.floor((refDate.getTime() - createdDate.getTime()) / MS_PER_DAY);

    matchedPairs.push({
      sortMs: createdDate.getTime(),
      item: {
        inquiryId: extractId(inquiry),
        propertyId,
        propertyName,
        createdAt: formatIsoDate(createdDate),
        daysPending,
      },
    });
  }

  matchedPairs.sort((a, b) => a.sortMs - b.sortMs);
  const evidence = matchedPairs.map((entry) => entry.item);

  let action = '';
  if (evidence.length === 1) {
    const first = evidence[0];
    action = `Respond to 1 inquiry pending for more than ${UNANSWERED_INQUIRY_DAYS} days on ${first.propertyName} (Property ID ${first.propertyId}).`;
  } else if (evidence.length > 1) {
    const first = evidence[0];
    action = `Respond to ${evidence.length} inquiries pending for more than ${UNANSWERED_INQUIRY_DAYS} days, oldest on ${first.propertyName} (Property ID ${first.propertyId}).`;
  }

  return {
    ruleId: 'STALE_PENDING_INQUIRIES',
    fired: evidence.length > 0,
    matchCount: evidence.length,
    action,
    evidence,
    sampleSize,
  };
}

export function evaluateOverdueSiteVisits({
  siteVisits = [],
  propertyNameById = new Map(),
  referenceDate = new Date(),
} = {}) {
  const dayStart = buildAsiaManilaDayStart(referenceDate);
  const pending = Array.isArray(siteVisits)
    ? siteVisits.filter((visit) => visit?.status === 'Pending')
    : [];
  const sampleSize = pending.length;

  const matchedPairs = [];
  for (const visit of pending) {
    const preferredDate = toValidDate(visit.preferredDate);
    if (!preferredDate || preferredDate.getTime() >= dayStart.getTime()) continue;

    const propertyId = extractId(visit.propertyId);
    const propertyName = lookupById(propertyNameById, propertyId) || 'Unavailable listing';

    matchedPairs.push({
      sortMs: preferredDate.getTime(),
      item: {
        siteVisitId: extractId(visit),
        propertyId,
        propertyName,
        preferredDate: formatIsoDate(preferredDate),
      },
    });
  }

  matchedPairs.sort((a, b) => a.sortMs - b.sortMs);
  const evidence = matchedPairs.map((entry) => entry.item);

  let action = '';
  if (evidence.length === 1) {
    const first = evidence[0];
    action = `Follow up on 1 pending site visit whose preferred date has passed on ${first.propertyName} (Property ID ${first.propertyId}).`;
  } else if (evidence.length > 1) {
    const first = evidence[0];
    action = `Follow up on ${evidence.length} pending site visits whose preferred dates have passed, earliest on ${first.propertyName} (Property ID ${first.propertyId}).`;
  }

  return {
    ruleId: 'OVERDUE_PENDING_SITE_VISITS',
    fired: evidence.length > 0,
    matchCount: evidence.length,
    action,
    evidence,
    sampleSize,
  };
}

export function buildPortfolioActions({
  listings = [],
  latestAuditByPropertyId = new Map(),
  inquiries = [],
  siteVisits = [],
  propertyNameById = new Map(),
  referenceDate = new Date(),
} = {}) {
  const rulesEvaluated = [
    evaluateHighRiskDocuments({ listings, latestAuditByPropertyId }),
    evaluateStaleInquiries({ inquiries, propertyNameById, referenceDate }),
    evaluateOverdueSiteVisits({ siteVisits, propertyNameById, referenceDate }),
  ];

  return {
    referenceDate: formatAsiaManilaDate(referenceDate),
    actions: rulesEvaluated.filter((result) => result.fired),
    rulesEvaluated,
  };
}
