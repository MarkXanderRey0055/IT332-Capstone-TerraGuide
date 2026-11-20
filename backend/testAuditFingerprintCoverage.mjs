import assert from 'node:assert/strict';
import {
  compareReadinessFreshness,
  createReadinessFingerprint,
  createReadinessSourceSnapshot,
} from './src/utils/auditReadiness.js';

const property = {
  name: 'Fingerprint Test Listing',
  owner: 'Named Owner',
  location: 'Balayan',
  type: 'Residential',
  price: 1_200_000,
  size: 100,
  lotSize: 1200,
  description: 'A listing for fingerprint tests.',
  suitableFor: ['Primary Residence'],
  images: ['image-a'],
  status: 'Available',
  documents: { deed: 'verified', tax: 'verified', survey: 'verified' },
  verificationRemarks: '',
};
const snapshot = createReadinessSourceSnapshot(property);
const fingerprint = createReadinessFingerprint(snapshot);
const compare = (currentProperty) => compareReadinessFreshness(
  { readinessSourceSnapshot: snapshot, readinessFingerprint: fingerprint },
  currentProperty
);

assert.equal(compare({ ...property, lotSize: 1200 }).freshnessStatus, 'CURRENT');
for (const lotSize of [0, -500, undefined]) {
  assert.equal(compare({ ...property, lotSize }).freshnessStatus, 'STALE');
}
assert.equal(compare({ ...property, owner: '' }).freshnessStatus, 'STALE');
assert.equal(compare({ ...property, price: 0 }).freshnessStatus, 'STALE');
assert.equal(compare({ ...property, images: [] }).freshnessStatus, 'STALE');
assert.equal(compare({ ...property, owner: 'Different named owner', images: ['image-b'] }).freshnessStatus, 'CURRENT');

const legacySnapshot = { ...snapshot, version: 1 };
delete legacySnapshot.ownerPresent;
delete legacySnapshot.imagesPresent;
assert.equal(
  compareReadinessFreshness(
    { readinessSourceSnapshot: legacySnapshot, readinessFingerprint: fingerprint },
    property
  ).freshnessStatus,
  'UNKNOWN'
);

console.log('Audit readiness fingerprint coverage tests passed.');
