import assert from 'node:assert/strict';
import Audit from './src/models/Audit.js';
import {
  assessPropertyReadiness,
  READINESS_CLASSIFICATIONS,
} from './src/utils/auditReadiness.js';

const property = {
  name: 'Test Property',
  type: 'Residential',
  location: 'Batangas',
  price: 1000000,
  status: 'Available',
  documents: { deed: 'verified', tax: 'pending', survey: 'verified' },
  size: 100,
  lotSize: 100,
  description: 'A test property.',
  suitableFor: ['Primary Residence'],
  owner: 'Test Owner',
  images: ['property.jpg'],
};

const readiness = assessPropertyReadiness(property, { hasAudit: true });
assert.equal(readiness.classification, READINESS_CLASSIFICATIONS.ATTENTION_REQUIRED);
assert.equal(readiness.criticalIssues.length, 0);
assert.equal(readiness.pendingItems.length, 1);
assert.equal(readiness.nonCriticalIssues.length, 0);

const readinessFor = (overrides) => assessPropertyReadiness({ ...property, ...overrides }, { hasAudit: true });
assert.equal(
  readinessFor({ documents: { deed: 'verified', tax: 'verified', survey: 'verified' } }).classification,
  READINESS_CLASSIFICATIONS.READY_FOR_PRESENTATION
);
assert.equal(
  readinessFor({ status: 'Reserved' }).classification,
  READINESS_CLASSIFICATIONS.NOT_APPLICABLE
);
assert.equal(
  readinessFor({ status: 'Sold' }).classification,
  READINESS_CLASSIFICATIONS.NOT_APPLICABLE
);
assert.equal(
  readinessFor({ documents: { deed: 'missing', tax: 'verified', survey: 'verified' } }).criticalIssues[0].code,
  'REQUIRED_DOCUMENT_MISSING'
);
assert.equal(
  readinessFor({ description: '' }).nonCriticalIssues[0].code,
  'MISSING_PROPERTY_DESCRIPTION'
);

for (const path of [
  'readinessClassification',
  'readinessClassificationLabel',
  'readinessIsReadyForPresentation',
  'readinessCriticalIssues',
  'readinessPendingItems',
  'readinessNonCriticalIssues',
  'narrativeOrigin',
  'narrativeFallbackReason',
]) {
  assert.ok(Audit.schema.path(path), `Audit schema is missing ${path}`);
}

const audit = new Audit({
  propertyId: '507f1f77bcf86cd799439011',
  complianceScore: 85,
  estimatedSuccessRate: 85,
  potentialSuccessRate: 85,
  riskLevel: 'Low',
  verifiedDocuments: 2,
  totalDocuments: 3,
  summary: 'summary',
  recommendation: 'recommendation',
  readinessClassification: readiness.classification,
  readinessClassificationLabel: readiness.label,
  readinessIsReadyForPresentation: readiness.isReadyForPresentation,
  readinessCriticalIssues: readiness.criticalIssues,
  readinessPendingItems: readiness.pendingItems,
  readinessNonCriticalIssues: readiness.nonCriticalIssues,
  narrativeOrigin: 'AI_GENERATED',
});

assert.equal(audit.validateSync(), undefined);
assert.equal(audit.readinessClassification, 'ATTENTION_REQUIRED');
assert.equal(audit.readinessPendingItems[0].code, 'REQUIRED_DOCUMENT_PENDING');
assert.equal(audit.narrativeOrigin, 'AI_GENERATED');

const legacyAudit = new Audit({
  propertyId: '507f1f77bcf86cd799439011',
  complianceScore: 100,
  estimatedSuccessRate: 100,
  potentialSuccessRate: 100,
  riskLevel: 'Low',
  verifiedDocuments: 3,
  totalDocuments: 3,
  summary: 'legacy summary',
  recommendation: 'legacy recommendation',
});

assert.equal(legacyAudit.validateSync(), undefined);
assert.equal(legacyAudit.readinessClassification, null);
assert.equal(legacyAudit.narrativeOrigin, null);

console.log('Audit persistence shape tests passed.');
