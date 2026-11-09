import { createHash } from 'node:crypto';
import Property from '../models/Property.js';

export const AUDIT_METHODOLOGY_VERSION = 'weighted-readiness-v1';

export const DOCUMENT_WEIGHTS = Object.freeze({ deed: 0.4, tax: 0.3, survey: 0.3 });
export const STATUS_MULTIPLIERS = Object.freeze({ verified: 1, pending: 0.5, missing: 0 });
export const DOCUMENT_LABELS = Object.freeze({
  deed: 'Deed of Sale',
  tax: 'Tax Declaration',
  survey: 'Survey Plan',
});

const PROPERTY_TYPES = Property.schema.path('type').enumValues;

export const READINESS_FINGERPRINT_FIELDS = Object.freeze([
  'name',
  'type',
  'location',
  'price',
  'size',
  'lotSize',
  'description',
  'suitableFor',
  'status',
  'documents.deed',
  'documents.tax',
  'documents.survey',
  'verificationRemarks',
]);

const SNAPSHOT_VERSION = 1;
const SNAPSHOT_DOCUMENT_KEYS = ['deed', 'tax', 'survey'];
const STALE_FIELD_LABELS = Object.freeze({
  name: 'Property Name',
  type: 'Property Type',
  location: 'Property Location',
  price: 'Property Price',
  size: 'Property Size',
  lotSize: 'Property Lot Size',
  description: 'Property Description',
  suitableFor: 'Suitable Uses',
  status: 'Listing Status',
  'documents.deed': 'Deed of Sale Status',
  'documents.tax': 'Tax Declaration Status',
  'documents.survey': 'Survey Plan Status',
  verificationRemarks: 'Verification Remarks',
});

function normalizeText(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeArray(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(normalizeText).filter(Boolean))].sort();
}

export function createReadinessSourceSnapshot(property = {}) {
  return {
    version: SNAPSHOT_VERSION,
    name: normalizeText(property.name),
    type: normalizeText(property.type),
    location: normalizeText(property.location),
    price: normalizeNumber(property.price),
    size: normalizeNumber(property.size),
    lotSize: normalizeNumber(property.lotSize),
    description: normalizeText(property.description),
    suitableFor: normalizeArray(property.suitableFor),
    status: normalizeText(property.status),
    documents: {
      deed: normalizeText(property.documents?.deed),
      tax: normalizeText(property.documents?.tax),
      survey: normalizeText(property.documents?.survey),
    },
    verificationRemarks: normalizeText(property.verificationRemarks),
  };
}

function isValidReadinessSourceSnapshot(snapshot) {
  return Boolean(
    snapshot &&
    snapshot.version === SNAPSHOT_VERSION &&
    Object.prototype.hasOwnProperty.call(snapshot, 'name') &&
    Object.prototype.hasOwnProperty.call(snapshot, 'type') &&
    Object.prototype.hasOwnProperty.call(snapshot, 'location') &&
    Object.prototype.hasOwnProperty.call(snapshot, 'price') &&
    Object.prototype.hasOwnProperty.call(snapshot, 'size') &&
    Object.prototype.hasOwnProperty.call(snapshot, 'lotSize') &&
    Object.prototype.hasOwnProperty.call(snapshot, 'description') &&
    Object.prototype.hasOwnProperty.call(snapshot, 'suitableFor') &&
    Object.prototype.hasOwnProperty.call(snapshot, 'status') &&
    Object.prototype.hasOwnProperty.call(snapshot, 'verificationRemarks') &&
    snapshot.documents &&
    SNAPSHOT_DOCUMENT_KEYS.every((key) => Object.prototype.hasOwnProperty.call(snapshot.documents, key)) &&
    Array.isArray(snapshot.suitableFor)
  );
}

export function createReadinessFingerprint(snapshot) {
  if (!isValidReadinessSourceSnapshot(snapshot)) {
    throw new Error('Invalid readiness source snapshot.');
  }

  const canonicalSnapshot = {
    version: snapshot.version,
    name: snapshot.name,
    type: snapshot.type,
    location: snapshot.location,
    price: snapshot.price,
    size: snapshot.size,
    lotSize: snapshot.lotSize,
    description: snapshot.description,
    suitableFor: [...snapshot.suitableFor].sort(),
    status: snapshot.status,
    documents: {
      deed: snapshot.documents.deed,
      tax: snapshot.documents.tax,
      survey: snapshot.documents.survey,
    },
    verificationRemarks: snapshot.verificationRemarks,
  };

  return createHash('sha256')
    .update(JSON.stringify(canonicalSnapshot))
    .digest('hex');
}

function getSnapshotValue(snapshot, field) {
  if (field.startsWith('documents.')) return snapshot.documents[field.split('.')[1]];
  return snapshot[field];
}

export function compareReadinessFreshness(audit, property) {
  const storedSnapshot = audit?.readinessSourceSnapshot;
  const storedFingerprint = audit?.readinessFingerprint;

  if (!isValidReadinessSourceSnapshot(storedSnapshot) || typeof storedFingerprint !== 'string' || !storedFingerprint) {
    return {
      freshnessStatus: 'UNKNOWN',
      isStale: false,
      staleReasons: [],
      snapshotAvailable: false,
    };
  }

  if (!property) {
    return {
      freshnessStatus: 'UNKNOWN',
      isStale: false,
      staleReasons: [],
      snapshotAvailable: true,
    };
  }

  const currentSnapshot = createReadinessSourceSnapshot(property);
  const currentFingerprint = createReadinessFingerprint(currentSnapshot);
  if (currentFingerprint === storedFingerprint) {
    return {
      freshnessStatus: 'CURRENT',
      isStale: false,
      staleReasons: [],
      snapshotAvailable: true,
    };
  }

  const staleReasons = READINESS_FINGERPRINT_FIELDS
    .filter((field) => JSON.stringify(getSnapshotValue(storedSnapshot, field)) !== JSON.stringify(getSnapshotValue(currentSnapshot, field)))
    .map((field) => ({
      field,
      label: STALE_FIELD_LABELS[field],
      previousValue: getSnapshotValue(storedSnapshot, field),
      currentValue: getSnapshotValue(currentSnapshot, field),
    }));

  return {
    freshnessStatus: 'STALE',
    isStale: true,
    staleReasons,
    snapshotAvailable: true,
  };
}

export const READINESS_CLASSIFICATIONS = Object.freeze({
  READY_FOR_PRESENTATION: 'READY_FOR_PRESENTATION',
  ATTENTION_REQUIRED: 'ATTENTION_REQUIRED',
  HOLD_FOR_REVIEW: 'HOLD_FOR_REVIEW',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  NOT_YET_ASSESSED: 'NOT_YET_ASSESSED',
});

const READINESS_LABELS = Object.freeze({
  READY_FOR_PRESENTATION: 'Ready for Presentation',
  ATTENTION_REQUIRED: 'Attention Required',
  HOLD_FOR_REVIEW: 'Hold for Review',
  NOT_APPLICABLE: 'Not Applicable',
  NOT_YET_ASSESSED: 'Not Yet Assessed',
});

const REQUIRED_DOCUMENT_KEYS = Object.keys(DOCUMENT_WEIGHTS);

function issue(category, field, severity, code, message) {
  return { category, field, severity, code, message };
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasNonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0;
}

/**
 * Deterministically classifies administrative listing readiness from the
 * current property record. This does not establish legal compliance,
 * ownership, title validity, or sale probability.
 *
 * `hasAudit: false` is reserved for the future audit-history integration;
 * the status gate remains first so Reserved/Sold records are never treated
 * as active presentation-ready listings.
 */
export function assessPropertyReadiness(property = {}, { hasAudit = true } = {}) {
  const criticalIssues = [];
  const pendingItems = [];
  const nonCriticalIssues = [];
  const status = property?.status;

  if (hasAudit === false && status !== 'Reserved' && status !== 'Sold') {
    return {
      classification: READINESS_CLASSIFICATIONS.NOT_YET_ASSESSED,
      label: READINESS_LABELS.NOT_YET_ASSESSED,
      criticalIssues,
      pendingItems,
      nonCriticalIssues,
      isReadyForPresentation: false,
    };
  }

  if (status !== 'Available' && status !== 'Reserved' && status !== 'Sold') {
    criticalIssues.push(issue('property_information', 'status', 'critical', 'INVALID_LISTING_STATUS', 'Listing status is missing or invalid.'));
  }

  const documents = property?.documents || {};
  for (const key of REQUIRED_DOCUMENT_KEYS) {
    const documentStatus = documents[key];
    if (documentStatus === 'missing') {
      criticalIssues.push(issue('document', `documents.${key}`, 'critical', 'REQUIRED_DOCUMENT_MISSING', `${DOCUMENT_LABELS[key]} is missing.`));
    } else if (documentStatus === 'pending') {
      pendingItems.push({
        category: 'document',
        field: `documents.${key}`,
        code: 'REQUIRED_DOCUMENT_PENDING',
        message: `${DOCUMENT_LABELS[key]} is pending verification.`,
      });
    } else if (documentStatus !== 'verified') {
      criticalIssues.push(issue('document', `documents.${key}`, 'critical', 'REQUIRED_DOCUMENT_STATUS_UNKNOWN', `${DOCUMENT_LABELS[key]} has an unknown or absent verification status.`));
    }
  }

  if (!hasText(property?.name)) {
    criticalIssues.push(issue('property_information', 'name', 'critical', 'MISSING_PROPERTY_NAME', 'Property name is missing.'));
  }

  if (!hasText(property?.type)) {
    criticalIssues.push(issue('property_information', 'type', 'critical', 'MISSING_PROPERTY_TYPE', 'Property type is missing.'));
  } else if (!PROPERTY_TYPES.includes(property.type)) {
    criticalIssues.push(issue('property_information', 'type', 'critical', 'INVALID_PROPERTY_TYPE', 'Property type is invalid.'));
  }

  if (!hasText(property?.location)) {
    criticalIssues.push(issue('property_information', 'location', 'critical', 'MISSING_PROPERTY_LOCATION', 'Property location is missing.'));
  }

  if (property?.price === null || property?.price === undefined || property?.price === '') {
    criticalIssues.push(issue('property_information', 'price', 'critical', 'MISSING_PROPERTY_PRICE', 'Property price is missing.'));
  } else if (typeof property.price !== 'number' || Number.isNaN(property.price) || !Number.isFinite(property.price)) {
    criticalIssues.push(issue('property_information', 'price', 'critical', 'INVALID_PROPERTY_PRICE', 'Property price must be a finite number.'));
  } else if (property.price === 0) {
    criticalIssues.push(issue('property_information', 'price', 'critical', 'ZERO_PROPERTY_PRICE', 'Property price must be greater than zero.'));
  } else if (property.price < 0) {
    criticalIssues.push(issue('property_information', 'price', 'critical', 'NEGATIVE_PROPERTY_PRICE', 'Property price cannot be negative.'));
  }

  const addNonCritical = (field, code, message) => {
    nonCriticalIssues.push(issue('property_information', field, 'non_critical', code, message));
  };

  if (property?.size === null || property?.size === undefined || property.size === 0) {
    addNonCritical('size', 'MISSING_PROPERTY_SIZE', 'Property size is missing.');
  }
  if (property?.lotSize === null || property?.lotSize === undefined || property.lotSize === 0) {
    addNonCritical('lotSize', 'MISSING_PROPERTY_LOT_SIZE', 'Property lot size is missing.');
  }
  if (!hasText(property?.description)) {
    addNonCritical('description', 'MISSING_PROPERTY_DESCRIPTION', 'Property description is missing.');
  }
  if (!hasNonEmptyArray(property?.suitableFor)) {
    addNonCritical('suitableFor', 'MISSING_SUITABLE_FOR', 'Suitable-use information is missing.');
  }
  if (!hasText(property?.owner)) {
    addNonCritical('owner', 'MISSING_PROPERTY_OWNER', 'Property owner information is missing.');
  }
  if (!hasNonEmptyArray(property?.images)) {
    addNonCritical('images', 'MISSING_PROPERTY_IMAGES', 'Property images are missing.');
  }

  const baseResult = {
    criticalIssues,
    pendingItems,
    nonCriticalIssues,
    isReadyForPresentation: false,
  };

  if (status === 'Reserved' || status === 'Sold') {
    return {
      ...baseResult,
      classification: READINESS_CLASSIFICATIONS.NOT_APPLICABLE,
      label: READINESS_LABELS.NOT_APPLICABLE,
    };
  }

  if (criticalIssues.length > 0) {
    return {
      ...baseResult,
      classification: READINESS_CLASSIFICATIONS.HOLD_FOR_REVIEW,
      label: READINESS_LABELS.HOLD_FOR_REVIEW,
    };
  }

  if (pendingItems.length > 0 || nonCriticalIssues.length > 0) {
    return {
      ...baseResult,
      classification: READINESS_CLASSIFICATIONS.ATTENTION_REQUIRED,
      label: READINESS_LABELS.ATTENTION_REQUIRED,
    };
  }

  return {
    ...baseResult,
    classification: READINESS_CLASSIFICATIONS.READY_FOR_PRESENTATION,
    label: READINESS_LABELS.READY_FOR_PRESENTATION,
    isReadyForPresentation: true,
  };
}

export function calculateDocumentReadiness(documents = {}) {
  const documentStatuses = {};
  const unknownStatuses = [];
  let weightedScore = 0;

  for (const key of Object.keys(DOCUMENT_WEIGHTS)) {
    const status = documents?.[key];
    const multiplier = STATUS_MULTIPLIERS[status];
    if (multiplier === undefined) {
      documentStatuses[key] = 'missing';
      unknownStatuses.push({ document: key, receivedStatus: status ?? null });
      continue;
    }
    documentStatuses[key] = status;
    weightedScore += DOCUMENT_WEIGHTS[key] * multiplier;
  }

  return {
    documentStatuses,
    documentCompleteness: Math.round(weightedScore * 100),
    unknownStatuses,
    verifiedList: Object.keys(documentStatuses)
      .filter((key) => documentStatuses[key] === 'verified')
      .map((key) => DOCUMENT_LABELS[key]),
    pendingItems: Object.keys(documentStatuses)
      .filter((key) => documentStatuses[key] === 'pending')
      .map((key) => DOCUMENT_LABELS[key]),
    missingItems: Object.keys(documentStatuses)
      .filter((key) => documentStatuses[key] === 'missing')
      .map((key) => DOCUMENT_LABELS[key]),
  };
}

export function classifyAuditRisk(documentCompleteness) {
  if (documentCompleteness >= 70) return 'Low';
  if (documentCompleteness >= 40) return 'Medium';
  return 'High';
}
