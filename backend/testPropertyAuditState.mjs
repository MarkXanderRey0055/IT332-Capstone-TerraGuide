import assert from 'node:assert/strict';
import Property from './src/models/Property.js';
import Audit from './src/models/Audit.js';
import { getAllProperties } from './src/services/propertyService.js';
import { createReadinessFingerprint, createReadinessSourceSnapshot } from './src/utils/auditReadiness.js';

const base = (id, status = 'Available') => ({
  _id: id,
  id,
  name: `Property ${id}`,
  owner: 'Property owner',
  type: 'Residential',
  location: 'Balayan, Batangas',
  price: 500000,
  size: 100,
  lotSize: 100,
  description: 'Property description',
  suitableFor: ['Investment'],
  status,
  documents: { deed: 'verified', tax: 'verified', survey: 'verified' },
  verificationRemarks: '',
  images: ['property.jpg'],
});

const currentProperty = base('current');
const staleProperty = base('stale');
const snapshotFor = (property) => createReadinessSourceSnapshot(property);
const auditFor = (property, overrides = {}) => {
  const readinessSourceSnapshot = snapshotFor(property);
  return {
    generatedAt: new Date('2026-10-01T00:00:00.000Z'),
    readinessSourceSnapshot,
    readinessFingerprint: createReadinessFingerprint(readinessSourceSnapshot),
    ...overrides,
  };
};
const legacyAudit = { generatedAt: new Date('2025-01-01T00:00:00.000Z') };
staleProperty.price += 1000;

const properties = [
  base('unaudited'),
  currentProperty,
  staleProperty,
  base('unknown'),
  base('reserved', 'Reserved'),
  base('sold', 'Sold'),
];
const audits = [
  { _id: 'current', audit: auditFor(base('current')) },
  { _id: 'stale', audit: auditFor(base('stale')) },
  { _id: 'unknown', audit: legacyAudit },
  { _id: 'reserved', audit: auditFor(base('reserved', 'Reserved')) },
  { _id: 'sold', audit: auditFor(base('sold', 'Sold')) },
];

const originalFind = Property.find;
const originalCountDocuments = Property.countDocuments;
const originalAggregate = Audit.aggregate;
let aggregateCalls = 0;
Property.countDocuments = async () => properties.length;
Property.find = () => {
  const query = {
    populate() { return this; },
    sort() { return this; },
    skip() { return this; },
    limit() { return Promise.resolve(properties); },
  };
  return query;
};
Audit.aggregate = async (pipeline) => {
  aggregateCalls += 1;
  assert.ok(pipeline.some((stage) => stage.$sort?.generatedAt === -1), 'latest audits are sorted newest first');
  assert.ok(pipeline.some((stage) => stage.$group?._id === '$propertyId'), 'audits are grouped by property in one aggregate');
  return audits;
};

try {
  const result = await getAllProperties({ limit: 100 }, { role: 'admin' });
  const stateById = new Map(result.properties.map((property) => [property.id, property.auditState]));
  assert.equal(stateById.get('unaudited').status, 'NOT_AUDITED');
  assert.equal(stateById.get('current').status, 'AUDITED');
  assert.equal(stateById.get('stale').status, 'STALE');
  assert.equal(stateById.get('unknown').status, 'UNKNOWN');
  assert.equal(stateById.get('reserved').status, 'AUDITED');
  assert.equal(stateById.get('sold').status, 'AUDITED');
  assert.ok(stateById.get('current').auditedAt instanceof Date);
  assert.equal(aggregateCalls, 1, 'the property list uses one batched latest-audit aggregation');
  console.log('Property audit-state tests passed: no-audit, current, stale, unknown, and reserved/sold records are summarized in one batch.');
} finally {
  Property.find = originalFind;
  Property.countDocuments = originalCountDocuments;
  Audit.aggregate = originalAggregate;
}
