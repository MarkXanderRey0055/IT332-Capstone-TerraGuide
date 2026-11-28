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
let lastPropertyFilter = null;
BuyerPreference.findOne = async () => currentPreferences;
Property.find = async (filter) => {
  lastPropertyFilter = filter;
  assert.equal(filter.status, 'Available', 'recommendations must remain Available-only');
  return currentCandidates.filter((property) => {
    if (property.status !== filter.status) return false;
    if (!filter.type) return true;
    if (typeof filter.type === 'object' && Array.isArray(filter.type.$in)) {
      return filter.type.$in.includes(property.type);
    }
    return property.type === filter.type;
  });
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

// Residential parent-category matching: Residential preference matches all three residential subtypes
// while preserving each property's exact stored type; specific subtype preferences remain exact.
currentCandidates = [
  makeProperty('res-lot', { type: 'Residential' }),
  makeProperty('house-lot', { type: 'House & Lot' }),
  makeProperty('condo-unit', { type: 'Condominium' }),
  makeProperty('farm-lot', { type: 'Agricultural' }),
  makeProperty('shop-lot', { type: 'Commercial' }),
];

currentPreferences = {
  budgetMin: null,
  budgetMax: null,
  landType: 'Residential',
  location: null,
  minLotSize: null,
  intendedUse: null,
};
const residentialRecs = await getBuyerRecommendations('buyer-test');
assert.deepEqual(lastPropertyFilter, {
  status: 'Available',
  type: { $in: ['Residential', 'House & Lot', 'Condominium'] },
});
assert.deepEqual(
  residentialRecs.properties.map((p) => ({ id: String(p._id), type: p.type })),
  [
    { id: 'condo-unit', type: 'Condominium' },
    { id: 'house-lot', type: 'House & Lot' },
    { id: 'res-lot', type: 'Residential' },
  ],
  'broad Residential preference must match all three residential subtypes and preserve exact stored types'
);

currentPreferences.landType = 'House & Lot';
const houseAndLotRecs = await getBuyerRecommendations('buyer-test');
assert.deepEqual(lastPropertyFilter, { status: 'Available', type: 'House & Lot' });
assert.deepEqual(
  houseAndLotRecs.properties.map((p) => ({ id: String(p._id), type: p.type })),
  [{ id: 'house-lot', type: 'House & Lot' }],
  'House & Lot preference must remain exact'
);

currentPreferences.landType = 'Condominium';
const condoRecs = await getBuyerRecommendations('buyer-test');
assert.deepEqual(lastPropertyFilter, { status: 'Available', type: 'Condominium' });
assert.deepEqual(
  condoRecs.properties.map((p) => ({ id: String(p._id), type: p.type })),
  [{ id: 'condo-unit', type: 'Condominium' }],
  'Condominium preference must remain exact'
);

currentPreferences.landType = 'Agricultural';
const agriRecs = await getBuyerRecommendations('buyer-test');
assert.deepEqual(lastPropertyFilter, { status: 'Available', type: 'Agricultural' });
assert.deepEqual(
  agriRecs.properties.map((p) => String(p._id)),
  ['farm-lot'],
  'Agricultural preference must remain exact'
);

console.log('Recommendation ranking tests passed (minimum-only budget, required fields, intended-use fallback, deterministic ties, Residential parent-category & subtype matching).');
