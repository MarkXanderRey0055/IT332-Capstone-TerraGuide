import Property from '../models/Property.js';
import Audit from '../models/Audit.js';
import AppError from '../utils/errors.js';
import {
  generateComplianceInsights,
  createDeterministicFallbackNarrative,
  logComplianceNarrativeFallback,
} from './aiService.js';
import {
  AUDIT_METHODOLOGY_VERSION,
  DOCUMENT_WEIGHTS,
  DOCUMENT_LABELS,
  calculateDocumentReadiness,
  classifyAuditRisk,
  assessPropertyReadiness,
  createReadinessSourceSnapshot,
  createReadinessFingerprint,
  compareReadinessFreshness,
} from '../utils/auditReadiness.js';

export async function generateAudit(propertyId, adminUserId) {
  const property = await Property.findById(propertyId);
  if (!property) {
    throw new AppError('Property not found.', 404);
  }

  const readiness = calculateDocumentReadiness(property.documents);
  const propertyReadiness = assessPropertyReadiness(property, { hasAudit: true });
  const unknownDocumentKeys = new Set(
    readiness.unknownStatuses.map(({ document }) => document)
  );
  const documentStatuses = Object.fromEntries(
    Object.entries(readiness.documentStatuses).map(([document, status]) => [
      document,
      unknownDocumentKeys.has(document) ? 'unknown' : status,
    ])
  );
  const documentStatusCounts = Object.values(documentStatuses).reduce(
    (counts, status) => ({ ...counts, [status]: (counts[status] || 0) + 1 }),
    { verified: 0, pending: 0, missing: 0, unknown: 0 }
  );
  const missingItems = Object.entries(documentStatuses)
    .filter(([, status]) => status === 'missing')
    .map(([document]) => DOCUMENT_LABELS[document]);
  const readinessSourceSnapshot = createReadinessSourceSnapshot(property);
  const readinessFingerprint = createReadinessFingerprint(readinessSourceSnapshot);
  const documentCompleteness = readiness.documentCompleteness;
  const riskLevel = classifyAuditRisk(documentCompleteness);
  // This is a readiness-based estimate, not a statistically validated sale probability.
  const estimatedSuccessRate = documentCompleteness;

  const narrativeFacts = {
    propertyName: property.name,
    propertyType: property.type,
    location: property.location,
    listingStatus: property.status,
    suitableFor: property.suitableFor,
    documentStatuses,
    documentStatusCounts,
    verifiedList: readiness.verifiedList,
    pendingItems: readiness.pendingItems,
    missingItems,
    unknownStatuses: readiness.unknownStatuses,
    readinessClassification: propertyReadiness.classification,
    readinessClassificationLabel: propertyReadiness.label,
    readinessIsReadyForPresentation: propertyReadiness.isReadyForPresentation,
    readinessCriticalIssues: propertyReadiness.criticalIssues,
    readinessPendingItems: propertyReadiness.pendingItems,
    readinessNonCriticalIssues: propertyReadiness.nonCriticalIssues,
    readinessSourceSnapshot,
    readinessFingerprint,
    documentCompleteness,
    estimatedSuccessRate,
    riskLevel,
  };

  // 4. Request and validate the AI narrative. Deterministic facts remain authoritative.
  let summary;
  let recommendation;
  let narrativeOrigin = 'AI_GENERATED';
  let narrativeFallbackReason = null;
  try {
    ({ summary, recommendation } = await generateComplianceInsights(narrativeFacts));
  } catch (error) {
    ({ summary, recommendation } = createDeterministicFallbackNarrative(narrativeFacts));
    narrativeOrigin = 'SYSTEM_FALLBACK';
    narrativeFallbackReason = error?.code === 'AI_CONTRADICTORY_RESPONSE'
      ? 'AI_CONTRADICTORY_RESPONSE'
      : error?.code === 'AI_INVALID_RESPONSE'
      ? 'AI_INVALID_RESPONSE'
      : 'AI_UNAVAILABLE';
    logComplianceNarrativeFallback({
      propertyId: property._id,
      fallbackReason: narrativeFallbackReason,
      error,
    });
  }

  // 5. Save complete record to MongoDB
  const audit = await Audit.create({
    propertyId: property._id,
    model: 'nvidia/nemotron-3.5-lightning-30b-a3b',
    methodologyVersion: AUDIT_METHODOLOGY_VERSION,
    documentWeights: DOCUMENT_WEIGHTS,
    documentStatuses: readiness.documentStatuses,
    documentCompleteness,
    complianceScore: documentCompleteness,
    estimatedSuccessRate,
    potentialSuccessRate: documentCompleteness,
    riskLevel,
    verifiedDocuments: readiness.verifiedList.length,
    totalDocuments: Object.keys(DOCUMENT_WEIGHTS).length,
    pendingItems: readiness.pendingItems,
    missingItems: readiness.missingItems,
    unknownStatuses: readiness.unknownStatuses,
    readinessSourceSnapshot,
    readinessFingerprint,
    readinessClassification: propertyReadiness.classification,
    readinessClassificationLabel: propertyReadiness.label,
    readinessIsReadyForPresentation: propertyReadiness.isReadyForPresentation,
    readinessCriticalIssues: propertyReadiness.criticalIssues,
    readinessPendingItems: propertyReadiness.pendingItems,
    readinessNonCriticalIssues: propertyReadiness.nonCriticalIssues,
    summary,
    recommendation,
    narrativeOrigin,
    narrativeFallbackReason,
    createdBy: adminUserId,
  });

  return audit;
}

export async function getAuditHistory(propertyId) {
  const property = await Property.findById(propertyId);
  const audits = await Audit.find({ propertyId }).sort({ generatedAt: -1 });

  if (!property && audits.length === 0) {
    throw new AppError('Property not found.', 404);
  }

  return audits.map((audit) => ({
    ...(typeof audit.toObject === 'function' ? audit.toObject() : audit),
    ...compareReadinessFreshness(audit, property),
  }));
}
