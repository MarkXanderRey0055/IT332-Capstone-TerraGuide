import { computeRiskLevel } from './auditReadiness.js';

// PROVISIONAL: pending confirmation from Smart Works.
export const UNANSWERED_INQUIRY_DAYS = 7;

// PROVISIONAL: pending confirmation from Smart Works (derived from UNANSWERED_INQUIRY_DAYS).
export const ELAPSED_INQUIRY_HOURS = UNANSWERED_INQUIRY_DAYS * 24;

// PROVISIONAL: uses existing High risk classification from computeRiskLevel.
export const HIGH_RISK_LEVEL = 'High';

export const HIGH_RISK_EVIDENCE_KEYS = [
  'propertyId',
  'propertyName',
  'type',
  'status',
  'complianceScore',
  'riskLevel',
];

export const STALE_INQUIRY_EVIDENCE_KEYS = [
  'inquiryId',
  'propertyId',
  'propertyName',
  'createdAtManila',
  'ageHours',
];

export const SITE_VISIT_EVIDENCE_KEYS = [
  'siteVisitId',
  'propertyId',
  'propertyName',
  'preferredDate',
];

const MS_PER_HOUR = 3600000;
const MANILA_OFFSET_MS = 8 * MS_PER_HOUR;
const ACTIVE_LISTING_STATUSES = new Set(['Available', 'Reserved']);

function pickKeys(source, keys) {
  const picked = {};
  for (const key of keys) {
    picked[key] = source[key];
  }
  return picked;
}

function toValidDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function assertValidReferenceDate(referenceDate) {
  const date = toValidDate(referenceDate);
  if (!date) {
    throw new TypeError('referenceDate must be a valid date');
  }
  return date;
}

function lookupById(source, id) {
  if (!source || !id) return undefined;
  const key = String(id);
  if (source instanceof Map) return source.get(key);
  if (typeof source === 'object') return source[key];
  return undefined;
}

export function extractId(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object') {
    if (typeof value.toHexString === 'function') {
      return String(value.toHexString()).trim();
    }
    if (value._id !== undefined && value._id !== null && value._id !== value) {
      return extractId(value._id);
    }
    if (typeof value.id === 'string') {
      return value.id.trim();
    }
    if (typeof value.toString === 'function' && value.toString !== Object.prototype.toString) {
      return String(value.toString()).trim();
    }
    return '';
  }
  return String(value).trim();
}

function pad2(num) {
  return String(num).padStart(2, '0');
}

export function formatManilaDate(date) {
  const valid = assertValidReferenceDate(date);
  const manilaWall = new Date(valid.getTime() + MANILA_OFFSET_MS);
  const year = manilaWall.getUTCFullYear();
  const month = pad2(manilaWall.getUTCMonth() + 1);
  const day = pad2(manilaWall.getUTCDate());
  return `${year}-${month}-${day}`;
}

export function formatManilaDateTime(date) {
  const valid = assertValidReferenceDate(date);
  const manilaWall = new Date(valid.getTime() + MANILA_OFFSET_MS);
  const year = manilaWall.getUTCFullYear();
  const month = pad2(manilaWall.getUTCMonth() + 1);
  const day = pad2(manilaWall.getUTCDate());
  const hours = pad2(manilaWall.getUTCHours());
  const minutes = pad2(manilaWall.getUTCMinutes());
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export function buildAsiaManilaDayStart(referenceDate) {
  const date = assertValidReferenceDate(referenceDate);
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
    if (!propertyId) continue;

    const audit = lookupById(latestAuditByPropertyId, propertyId);
    const riskLevel = computeRiskLevel(audit);
    if (riskLevel === null) continue;

    sampleSize += 1;

    if (riskLevel === HIGH_RISK_LEVEL) {
      matches.push(
        pickKeys(
          {
            propertyId,
            propertyName: listing.name || 'Unnamed listing',
            type: listing.type ?? '',
            status: listing.status,
            complianceScore: audit.complianceScore ?? audit.documentCompleteness,
            riskLevel,
          },
          HIGH_RISK_EVIDENCE_KEYS
        )
      );
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
  referenceDate,
} = {}) {
  const refDate = assertValidReferenceDate(referenceDate);
  const thresholdMs = ELAPSED_INQUIRY_HOURS * MS_PER_HOUR;
  const pending = Array.isArray(inquiries)
    ? inquiries.filter((inquiry) => inquiry?.status === 'Pending')
    : [];
  const sampleSize = pending.length;

  const matchedPairs = [];
  for (const inquiry of pending) {
    const createdDate = toValidDate(inquiry.createdAt);
    if (!createdDate) continue;
    const elapsedMs = refDate.getTime() - createdDate.getTime();
    if (elapsedMs <= thresholdMs) continue;

    const propertyId = extractId(inquiry.propertyId);
    const propertyName = lookupById(propertyNameById, propertyId) || 'Unavailable listing';
    const ageHours = Math.floor(elapsedMs / MS_PER_HOUR);

    matchedPairs.push({
      sortMs: createdDate.getTime(),
      item: pickKeys(
        {
          inquiryId: extractId(inquiry),
          propertyId,
          propertyName,
          createdAtManila: formatManilaDateTime(createdDate),
          ageHours,
        },
        STALE_INQUIRY_EVIDENCE_KEYS
      ),
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
  referenceDate,
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
      item: pickKeys(
        {
          siteVisitId: extractId(visit),
          propertyId,
          propertyName,
          preferredDate: formatManilaDate(preferredDate),
        },
        SITE_VISIT_EVIDENCE_KEYS
      ),
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
  referenceDate,
} = {}) {
  const validReferenceDate = assertValidReferenceDate(referenceDate);
  const rulesEvaluated = [
    evaluateHighRiskDocuments({ listings, latestAuditByPropertyId }),
    evaluateStaleInquiries({ inquiries, propertyNameById, referenceDate: validReferenceDate }),
    evaluateOverdueSiteVisits({ siteVisits, propertyNameById, referenceDate: validReferenceDate }),
  ];

  return {
    referenceDate: formatManilaDate(validReferenceDate),
    computedAt: validReferenceDate.toISOString(),
    actions: rulesEvaluated.filter((result) => result.fired),
    rulesEvaluated,
  };
}
