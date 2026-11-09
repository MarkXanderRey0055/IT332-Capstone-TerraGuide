import assert from 'node:assert/strict';
import {
  calculateDocumentReadiness,
  classifyAuditRisk,
  assessPropertyReadiness,
  READINESS_CLASSIFICATIONS,
} from './src/utils/auditReadiness.js';

const statuses = (deed, tax, survey) => ({ deed, tax, survey });

assert.equal(calculateDocumentReadiness(statuses('verified', 'verified', 'verified')).documentCompleteness, 100);
assert.equal(calculateDocumentReadiness(statuses('pending', 'verified', 'verified')).documentCompleteness, 80);
assert.equal(calculateDocumentReadiness(statuses('verified', 'pending', 'verified')).documentCompleteness, 85);
assert.equal(calculateDocumentReadiness(statuses('verified', 'verified', 'pending')).documentCompleteness, 85);
assert.equal(calculateDocumentReadiness(statuses('missing', 'verified', 'verified')).documentCompleteness, 60);
assert.equal(calculateDocumentReadiness(statuses('pending', 'pending', 'pending')).documentCompleteness, 50);
assert.equal(calculateDocumentReadiness(statuses('missing', 'missing', 'missing')).documentCompleteness, 0);

const unknown = calculateDocumentReadiness({ deed: 'rejected', tax: 'verified', survey: undefined });
assert.equal(unknown.documentCompleteness, 30);
assert.deepEqual(unknown.unknownStatuses, [
  { document: 'deed', receivedStatus: 'rejected' },
  { document: 'survey', receivedStatus: null },
]);

assert.equal(classifyAuditRisk(70), 'Low');
assert.equal(classifyAuditRisk(40), 'Medium');
assert.equal(classifyAuditRisk(39), 'High');

const validProperty = (documents, overrides = {}) => ({
  name: 'Test Property',
  type: 'Residential',
  location: 'Batangas',
  price: 1000000,
  status: 'Available',
  documents,
  size: 100,
  lotSize: 100,
  description: 'A test property.',
  suitableFor: ['Primary Residence'],
  owner: 'Test Owner',
  images: ['https://example.com/property.jpg'],
  ...overrides,
});

assert.equal(
  assessPropertyReadiness(validProperty(statuses('verified', 'verified', 'verified'))).classification,
  READINESS_CLASSIFICATIONS.READY_FOR_PRESENTATION
);
for (const document of ['deed', 'tax', 'survey']) {
  const pending = statuses('verified', 'verified', 'verified');
  pending[document] = 'pending';
  const result = assessPropertyReadiness(validProperty(pending));
  assert.equal(result.classification, READINESS_CLASSIFICATIONS.ATTENTION_REQUIRED);
  assert.equal(result.pendingItems.length, 1);
}
for (const document of ['deed', 'tax', 'survey']) {
  const missing = statuses('verified', 'verified', 'verified');
  missing[document] = 'missing';
  assert.equal(
    assessPropertyReadiness(validProperty(missing)).classification,
    READINESS_CLASSIFICATIONS.HOLD_FOR_REVIEW
  );
}

for (const document of ['deed', 'tax', 'survey']) {
  const unknown = statuses('verified', 'verified', 'verified');
  unknown[document] = 'unknown';
  const result = assessPropertyReadiness(validProperty(unknown));
  assert.equal(result.classification, READINESS_CLASSIFICATIONS.HOLD_FOR_REVIEW);
  assert.equal(result.criticalIssues[0].code, 'REQUIRED_DOCUMENT_STATUS_UNKNOWN');
}

for (const document of ['deed', 'tax', 'survey']) {
  const absent = statuses('verified', 'verified', 'verified');
  delete absent[document];
  assert.equal(
    assessPropertyReadiness(validProperty(absent)).classification,
    READINESS_CLASSIFICATIONS.HOLD_FOR_REVIEW
  );
}

for (const [field, value, code] of [
  ['name', '', 'MISSING_PROPERTY_NAME'],
  ['name', '   ', 'MISSING_PROPERTY_NAME'],
  ['type', undefined, 'MISSING_PROPERTY_TYPE'],
  ['type', 'Invalid Type', 'INVALID_PROPERTY_TYPE'],
  ['location', '', 'MISSING_PROPERTY_LOCATION'],
  ['location', ' ', 'MISSING_PROPERTY_LOCATION'],
  ['price', undefined, 'MISSING_PROPERTY_PRICE'],
  ['price', null, 'MISSING_PROPERTY_PRICE'],
  ['price', 0, 'ZERO_PROPERTY_PRICE'],
  ['price', -1, 'NEGATIVE_PROPERTY_PRICE'],
  ['price', Number.NaN, 'INVALID_PROPERTY_PRICE'],
  ['price', '1000000', 'INVALID_PROPERTY_PRICE'],
]) {
  const result = assessPropertyReadiness(validProperty(statuses('verified', 'verified', 'verified'), { [field]: value }));
  assert.equal(result.classification, READINESS_CLASSIFICATIONS.HOLD_FOR_REVIEW);
  assert.ok(result.criticalIssues.some((item) => item.code === code));
}

for (const status of ['Reserved', 'Sold']) {
  const result = assessPropertyReadiness(validProperty(statuses('missing', 'missing', 'missing'), { status }));
  assert.equal(result.classification, READINESS_CLASSIFICATIONS.NOT_APPLICABLE);
}

assert.equal(
  assessPropertyReadiness(validProperty(statuses('verified', 'verified', 'verified')), { hasAudit: false }).classification,
  READINESS_CLASSIFICATIONS.NOT_YET_ASSESSED
);

for (const overrides of [
  [{ size: undefined }, 'MISSING_PROPERTY_SIZE'],
  [{ size: 0 }, 'MISSING_PROPERTY_SIZE'],
  [{ lotSize: undefined }, 'MISSING_PROPERTY_LOT_SIZE'],
  [{ lotSize: 0 }, 'MISSING_PROPERTY_LOT_SIZE'],
  [{ description: '' }, 'MISSING_PROPERTY_DESCRIPTION'],
  [{ suitableFor: undefined }, 'MISSING_SUITABLE_FOR'],
  [{ suitableFor: [] }, 'MISSING_SUITABLE_FOR'],
  [{ owner: '' }, 'MISSING_PROPERTY_OWNER'],
  [{ images: [] }, 'MISSING_PROPERTY_IMAGES'],
]) {
  const [fields, code] = overrides;
  const result = assessPropertyReadiness(validProperty(statuses('verified', 'verified', 'verified'), fields));
  assert.equal(result.classification, READINESS_CLASSIFICATIONS.ATTENTION_REQUIRED);
  assert.equal(result.nonCriticalIssues.filter((item) => item.code === code).length, 1);
}

for (const overrides of [
  { size: 0 },
  { lotSize: 0 },
  { description: '' },
  { suitableFor: [] },
  { owner: '' },
  { images: [] },
]) {
  assert.equal(
    assessPropertyReadiness(validProperty(statuses('verified', 'verified', 'verified'), overrides)).nonCriticalIssues.length,
    1
  );
}

const mixed = validProperty(statuses('verified', 'pending', 'missing'));
const before = JSON.stringify(mixed);
const mixedResult = assessPropertyReadiness(mixed);
assert.equal(mixedResult.classification, READINESS_CLASSIFICATIONS.HOLD_FOR_REVIEW);
assert.equal(mixedResult.pendingItems.length, 1);
assert.equal(JSON.stringify(mixed), before);

console.log('Audit readiness tests passed.');
