import assert from 'node:assert/strict';
import Property from './src/models/Property.js';
import Audit from './src/models/Audit.js';
import BuyerPreference from './src/models/BuyerPreference.js';
import { toPublicProperty } from './src/utils/publicPropertyView.js';
import { getAllProperties, getPropertyById } from './src/services/propertyService.js';
import { getBuyerRecommendations } from './src/services/recommendationService.js';

const sampleProperty = () => ({
  _id: 'prop-1',
  id: 'prop-1',
  name: 'Sunny Ridge Lot',
  owner: 'Private Owner Name',
  location: 'Lipa City, Batangas',
  type: 'Residential',
  status: 'Available',
  price: 2_000_000,
  lotSize: 500,
  lat: 13.94,
  lng: 121.16,
  documents: { deed: 'verified', tax: 'verified', survey: 'pending' },
  cabinetId: 'cab-1',
  verificationRemarks: 'Internal staff note',
  documentVerificationHistory: [
    {
      document: 'deed',
      previousStatus: 'pending',
      newStatus: 'verified',
      remarks: 'Checked original',
      changedBy: { fullName: 'Staff Member', username: 'staff1' },
      changedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
});

// a. toPublicProperty removes owner, documentVerificationHistory, and verificationRemarks
// b. toPublicProperty does not mutate its input
const originalInput = sampleProperty();
const inputSnapshot = structuredClone(originalInput);
const sanitized = toPublicProperty(originalInput);

assert.equal('owner' in sanitized, false, 'owner must be omitted');
assert.equal('documentVerificationHistory' in sanitized, false, 'documentVerificationHistory must be omitted');
assert.equal('verificationRemarks' in sanitized, false, 'verificationRemarks must be omitted');
assert.equal(sanitized.name, 'Sunny Ridge Lot');
assert.deepEqual(sanitized.documents, originalInput.documents, 'documents must remain intact');
assert.equal(sanitized.cabinetId, 'cab-1', 'cabinetId must remain intact');
assert.deepEqual(originalInput, inputSnapshot, 'toPublicProperty must not mutate its input');

const originalCountDocuments = Property.countDocuments;
const originalFind = Property.find;
const originalFindById = Property.findById;
const originalAggregate = Audit.aggregate;
const originalPrefFindOne = BuyerPreference.findOne;

const seenFilters = [];
const populateCalls = [];

Property.countDocuments = async () => 1;
Property.find = (filter = {}) => {
  seenFilters.push(filter);
  const rows = [sampleProperty()];
  const query = {
    populate(...args) {
      populateCalls.push({ source: 'find', args });
      return this;
    },
    sort() { return this; },
    skip() { return this; },
    limit() { return this; },
    then(resolve, reject) { return Promise.resolve(rows).then(resolve, reject); },
  };
  return query;
};
Property.findById = (id) => {
  const row = id === 'prop-1' ? sampleProperty() : null;
  const query = {
    populate(...args) {
      populateCalls.push({ source: 'findById', args });
      return this;
    },
    then(resolve, reject) { return Promise.resolve(row).then(resolve, reject); },
  };
  return query;
};
Audit.aggregate = async () => [];
BuyerPreference.findOne = async () => ({
  budgetMin: 1_000_000,
  budgetMax: 3_000_000,
  landType: 'Residential',
  location: 'Lipa City',
  minLotSize: 200,
  intendedUse: null,
});

try {
  // c. getAllProperties with anonymous user (undefined)
  populateCalls.length = 0;
  const anonResult = await getAllProperties({ search: 'Private' });
  const anonFilter = seenFilters.at(-1);
  assert.ok(Array.isArray(anonFilter.$or), 'anonymous search builds $or filter');
  assert.equal(
    anonFilter.$or.some((clause) => Object.hasOwn(clause, 'owner')),
    false,
    'anonymous search must not include owner in $or'
  );
  assert.equal(populateCalls.length, 0, 'anonymous getAllProperties must not populate changedBy');
  assert.equal('owner' in anonResult.properties[0], false);
  assert.equal('documentVerificationHistory' in anonResult.properties[0], false);
  assert.equal('verificationRemarks' in anonResult.properties[0], false);

  // d. getAllProperties with { role: 'buyer' }
  populateCalls.length = 0;
  const buyerResult = await getAllProperties({ search: 'Private' }, { role: 'buyer' });
  const buyerFilter = seenFilters.at(-1);
  assert.equal(
    buyerFilter.$or.some((clause) => Object.hasOwn(clause, 'owner')),
    false,
    'buyer search must not include owner in $or'
  );
  assert.equal(populateCalls.length, 0, 'buyer getAllProperties must not populate changedBy');
  assert.equal('owner' in buyerResult.properties[0], false);
  assert.equal('documentVerificationHistory' in buyerResult.properties[0], false);
  assert.equal('verificationRemarks' in buyerResult.properties[0], false);

  // e. getAllProperties with { role: 'admin' }
  populateCalls.length = 0;
  const adminResult = await getAllProperties({ search: 'Private' }, { role: 'admin' });
  const adminFilter = seenFilters.at(-1);
  assert.equal(
    adminFilter.$or.some((clause) => Object.hasOwn(clause, 'owner')),
    true,
    'admin search must include owner in $or'
  );
  assert.equal(populateCalls.length, 1, 'admin getAllProperties must populate changedBy');
  assert.equal(adminResult.properties[0].owner, 'Private Owner Name');
  assert.equal(adminResult.properties[0].verificationRemarks, 'Internal staff note');
  assert.equal(adminResult.properties[0].documentVerificationHistory.length, 1);

  // f. getPropertyById with anonymous vs admin
  populateCalls.length = 0;
  const anonDetail = await getPropertyById('prop-1');
  assert.equal(populateCalls.length, 0, 'anonymous getPropertyById must not populate changedBy');
  assert.equal('owner' in anonDetail, false);
  assert.equal('documentVerificationHistory' in anonDetail, false);
  assert.equal('verificationRemarks' in anonDetail, false);

  populateCalls.length = 0;
  const adminDetail = await getPropertyById('prop-1', { role: 'admin' });
  assert.equal(populateCalls.length, 1, 'admin getPropertyById must populate changedBy');
  assert.equal(adminDetail.owner, 'Private Owner Name');
  assert.equal(adminDetail.verificationRemarks, 'Internal staff note');
  assert.equal(adminDetail.documentVerificationHistory.length, 1);

  // g. getBuyerRecommendations results contain no owner, history, or remarks
  const recResult = await getBuyerRecommendations('buyer-1');
  assert.equal(recResult.properties.length, 1);
  assert.equal('owner' in recResult.properties[0], false);
  assert.equal('documentVerificationHistory' in recResult.properties[0], false);
  assert.equal('verificationRemarks' in recResult.properties[0], false);

  console.log('Public property view tests passed: non-admin list/detail/recommendations strip owner, history, and remarks; admin retains full data and owner search.');
} finally {
  Property.countDocuments = originalCountDocuments;
  Property.find = originalFind;
  Property.findById = originalFindById;
  Audit.aggregate = originalAggregate;
  BuyerPreference.findOne = originalPrefFindOne;
}
