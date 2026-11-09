import assert from 'node:assert/strict';
import {
  createReadinessSourceSnapshot,
  createReadinessFingerprint,
  compareReadinessFreshness,
} from './src/utils/auditReadiness.js';

const baseProperty = {
  name: 'Coastal Retreat',
  type: 'Residential',
  location: 'Nasugbu',
  price: 5000000,
  size: 120,
  lotSize: 300,
  description: 'A property description.',
  suitableFor: ['Vacation Home', 'Investment'],
  status: 'Available',
  documents: { deed: 'verified', tax: 'pending', survey: 'verified' },
  verificationRemarks: 'Reviewed by admin',
  owner: 'Excluded owner value',
  images: ['image-a'],
  cabinetId: 'excluded-cabinet',
};

const snapshot = createReadinessSourceSnapshot(baseProperty);
const fingerprint = createReadinessFingerprint(snapshot);
assert.equal(createReadinessFingerprint(createReadinessSourceSnapshot(baseProperty)), fingerprint);

const reorderedSnapshot = {
  verificationRemarks: snapshot.verificationRemarks,
  documents: { survey: 'verified', deed: 'verified', tax: 'pending' },
  status: snapshot.status,
  suitableFor: ['Investment', 'Vacation Home'],
  description: snapshot.description,
  lotSize: snapshot.lotSize,
  size: snapshot.size,
  price: snapshot.price,
  location: snapshot.location,
  type: snapshot.type,
  name: snapshot.name,
  version: snapshot.version,
};
assert.equal(createReadinessFingerprint(reorderedSnapshot), fingerprint);

const missingOptional = createReadinessSourceSnapshot({ ...baseProperty, description: undefined, suitableFor: undefined });
const explicitOptional = createReadinessSourceSnapshot({ ...baseProperty, description: null, suitableFor: [] });
assert.equal(createReadinessFingerprint(missingOptional), createReadinessFingerprint(explicitOptional));

const unchanged = JSON.parse(JSON.stringify(baseProperty));
assert.deepEqual(baseProperty, {
  ...unchanged,
});

const current = compareReadinessFreshness(
  { readinessSourceSnapshot: snapshot, readinessFingerprint: fingerprint },
  baseProperty
);
assert.deepEqual(current, {
  freshnessStatus: 'CURRENT',
  isStale: false,
  staleReasons: [],
  snapshotAvailable: true,
});

for (const [field, value, expectedField] of [
  ['price', 5500000, 'price'],
  ['description', 'Updated description', 'description'],
  ['location', 'Calatagan', 'location'],
  ['status', 'Reserved', 'status'],
  ['size', 140, 'size'],
  ['lotSize', 350, 'lotSize'],
  ['verificationRemarks', 'New review note', 'verificationRemarks'],
]) {
  const result = compareReadinessFreshness(
    { readinessSourceSnapshot: snapshot, readinessFingerprint: fingerprint },
    { ...baseProperty, [field]: value }
  );
  assert.equal(result.freshnessStatus, 'STALE');
  assert.deepEqual(result.staleReasons.map((reason) => reason.field), [expectedField]);
}

for (const [field, value, expectedField] of [
  ['documents', { deed: 'verified', tax: 'verified', survey: 'verified' }, 'documents.tax'],
  ['suitableFor', ['Investment'], 'suitableFor'],
]) {
  const result = compareReadinessFreshness(
    { readinessSourceSnapshot: snapshot, readinessFingerprint: fingerprint },
    { ...baseProperty, [field]: value }
  );
  assert.equal(result.freshnessStatus, 'STALE');
  assert.deepEqual(result.staleReasons.map((reason) => reason.field), [expectedField]);
}

for (const field of ['owner', 'images', 'cabinetId']) {
  const result = compareReadinessFreshness(
    { readinessSourceSnapshot: snapshot, readinessFingerprint: fingerprint },
    { ...baseProperty, [field]: field === 'images' ? ['image-b'] : 'changed' }
  );
  assert.equal(result.freshnessStatus, 'CURRENT');
}

const multipleChanges = compareReadinessFreshness(
  { readinessSourceSnapshot: snapshot, readinessFingerprint: fingerprint },
  { ...baseProperty, price: 5500000, status: 'Sold', owner: 'ignored' }
);
assert.equal(multipleChanges.freshnessStatus, 'STALE');
assert.deepEqual(multipleChanges.staleReasons.map((reason) => reason.field), ['price', 'status']);

assert.equal(
  compareReadinessFreshness({ readinessSourceSnapshot: null, readinessFingerprint: null }, baseProperty).freshnessStatus,
  'UNKNOWN'
);
assert.equal(
  compareReadinessFreshness({ readinessSourceSnapshot: { version: 1 }, readinessFingerprint: 'bad' }, baseProperty).freshnessStatus,
  'UNKNOWN'
);
assert.equal(
  compareReadinessFreshness(null, null).freshnessStatus,
  'UNKNOWN'
);
assert.equal(
  compareReadinessFreshness({ readinessSourceSnapshot: snapshot, readinessFingerprint: fingerprint }, null).freshnessStatus,
  'UNKNOWN'
);

console.log('Audit freshness tests passed.');
