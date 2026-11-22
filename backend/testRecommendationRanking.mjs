import assert from 'node:assert/strict';
import BuyerPreference from './src/models/BuyerPreference.js';
import Property from './src/models/Property.js';
import { getBuyerRecommendations } from './src/services/recommendationService.js';

const makeProperty = (id, overrides = {}) => ({
  _id: id,
  status: 'Available',
  type: 'Residential',
  price: 2_000_000,
  location: 'Lipa City, Batangas',
  lotSize: 1_000,
  suitableFor: ['Primary Residence'],
  createdAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

let currentPreferences = null;
let currentCandidates = [];
BuyerPreference.findOne = async () => currentPreferences;
Property.find = async (filter) => {
  assert.equal(filter.status, 'Available', 'recommendations must remain Available-only');
  return currentCandidates.filter((property) =>
    property.status === filter.status && (!filter.type || property.type === filter.type)
  );
};

const getIds = async () =>
  (await getBuyerRecommendations('buyer-test')).properties.map((property) => String(property._id));

currentPreferences = {
  budgetMin: 2_000_000,
  budgetMax: null,
  landType: null,
  location: null,
  minLotSize: null,
  intendedUse: null,
};
currentCandidates = [
  makeProperty('below-minimum', { price: 1_000_000 }),
  makeProperty('at-minimum', { price: 2_000_000 }),
];
assert.deepEqual(
  await getIds(),
  ['at-minimum', 'below-minimum'],
  'a price below a minimum-only budget should score lower than a price at the minimum'
);

currentPreferences = {
  budgetMin: null,
  budgetMax: null,
  landType: null,
  location: null,
  minLotSize: null,
  intendedUse: 'Primary Residence',
};
currentCandidates = [
  // All ranking inputs match except suitableFor; the missing tag therefore
  // contributes zero intended-use points but does not remove the property.
  makeProperty('no-suitable-for', { suitableFor: undefined }),
  makeProperty('matching-use', { suitableFor: ['Primary Residence'] }),
  makeProperty('missing-price', { price: undefined }),
  makeProperty('empty-location', { location: '  ' }),
];
assert.deepEqual(
  await getIds(),
  ['matching-use', 'no-suitable-for'],
  'invalid price/location candidates must be excluded while missing suitableFor remains eligible'
);

currentPreferences.intendedUse = 'Primary Residence';
currentCandidates = [
  makeProperty('property-b'),
  makeProperty('property-a'),
];
const firstTieOrder = await getIds();
const secondTieOrder = await getIds();
assert.deepEqual(firstTieOrder, ['property-a', 'property-b']);
assert.deepEqual(secondTieOrder, firstTieOrder, 'identical score/date ties must be deterministic');

console.log('Recommendation ranking tests passed (minimum-only budget, required fields, intended-use fallback, deterministic ties).');
