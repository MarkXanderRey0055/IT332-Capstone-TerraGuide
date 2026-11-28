import assert from 'node:assert/strict';
import Property from './src/models/Property.js';
import Audit from './src/models/Audit.js';
import SearchEvent from './src/models/SearchEvent.js';
import { getAllProperties } from './src/services/propertyService.js';
import {
  RESIDENTIAL_SUBTYPES,
  isResidentialSubtype,
  expandBuyerPropertyTypeFilter,
} from '../shared/propertyCategories.mjs';

let assertions = 0;
const check = (fn) => {
  fn();
  assertions += 1;
};

// 1. Unit tests for shared/propertyCategories.mjs
check(() => assert.deepEqual(RESIDENTIAL_SUBTYPES, ['Residential', 'House & Lot', 'Condominium']));
check(() => assert.equal(expandBuyerPropertyTypeFilter(''), null));
check(() => assert.equal(expandBuyerPropertyTypeFilter(null), null));
check(() => assert.equal(expandBuyerPropertyTypeFilter(undefined), null));

const expandedResidential = expandBuyerPropertyTypeFilter('Residential');
check(() => assert.deepEqual(expandedResidential, ['Residential', 'House & Lot', 'Condominium']));
expandedResidential.push('Mutated');
check(() => assert.deepEqual(RESIDENTIAL_SUBTYPES, ['Residential', 'House & Lot', 'Condominium']));

check(() => assert.deepEqual(expandBuyerPropertyTypeFilter('House & Lot'), ['House & Lot']));
check(() => assert.deepEqual(expandBuyerPropertyTypeFilter('Condominium'), ['Condominium']));
check(() => assert.deepEqual(expandBuyerPropertyTypeFilter('Agricultural'), ['Agricultural']));
check(() => assert.deepEqual(expandBuyerPropertyTypeFilter('Commercial'), ['Commercial']));
check(() => assert.equal(isResidentialSubtype('Residential'), true));
check(() => assert.equal(isResidentialSubtype('House & Lot'), true));
check(() => assert.equal(isResidentialSubtype('Condominium'), true));
check(() => assert.equal(isResidentialSubtype('Agricultural'), false));
check(() => assert.equal(isResidentialSubtype('Commercial'), false));

// 2. Buyer, anonymous, and admin discovery tests via getAllProperties
const originalCountDocuments = Property.countDocuments;
const originalFind = Property.find;
const originalAuditAggregate = Audit.aggregate;
const originalSearchEventCreate = SearchEvent.create;

const fixtures = [
  { _id: 'p-res-avail', name: 'Res Lot', type: 'Residential', location: 'Lipa', status: 'Available', price: 1_500_000, lat: 14, lng: 121 },
  { _id: 'p-res-sold', name: 'Res Sold', type: 'Residential', location: 'Lipa', status: 'Sold', price: 1_500_000, lat: 14, lng: 121 },
  { _id: 'p-hl-avail', name: 'Family Home', type: 'House & Lot', location: 'Lipa', status: 'Available', price: 4_500_000, lat: 14, lng: 121 },
  { _id: 'p-hl-reserved', name: 'Reserved Home', type: 'House & Lot', location: 'Lipa', status: 'Reserved', price: 4_500_000, lat: 14, lng: 121 },
  { _id: 'p-condo-avail', name: 'City Condo', type: 'Condominium', location: 'Lipa', status: 'Available', price: 3_200_000, lat: 14, lng: 121 },
  { _id: 'p-agri-avail', name: 'Farm Lot', type: 'Agricultural', location: 'Nasugbu', status: 'Available', price: 2_000_000, lat: 14, lng: 121 },
  { _id: 'p-com-avail', name: 'Shop Lot', type: 'Commercial', location: 'Batangas', status: 'Available', price: 5_000_000, lat: 14, lng: 121 },
];

const matchesFilter = (item, filter) => {
  if (filter.status && item.status !== filter.status) return false;
  if (filter.type) {
    if (typeof filter.type === 'object' && Array.isArray(filter.type.$in)) {
      if (!filter.type.$in.includes(item.type)) return false;
    } else if (item.type !== filter.type) {
      return false;
    }
  }
  return true;
};

try {
  const seenFilters = [];
  const recordedEvents = [];

  Property.countDocuments = async (filter = {}) =>
    fixtures.filter((item) => matchesFilter(item, filter)).length;

  Property.find = (filter = {}) => {
    seenFilters.push(filter);
    const rows = fixtures.filter((item) => matchesFilter(item, filter));
    let offset = 0;
    let max = rows.length;
    return {
      populate() { return this; },
      sort() { return this; },
      skip(value) { offset = value; return this; },
      limit(value) { max = value; return this; },
      then(resolve, reject) {
        return Promise.resolve(rows.slice(offset, offset + max)).then(resolve, reject);
      },
    };
  };

  Audit.aggregate = async () => [];
  SearchEvent.create = async (event) => {
    recordedEvents.push(event);
    return event;
  };

  // Buyer Residential search expands via $in and stays Available-only
  const buyerRes = await getAllProperties(
    { type: 'Residential', recordSearch: 'true', limit: 100 },
    { role: 'buyer', _id: 'buyer-1' }
  );
  check(() => assert.deepEqual(seenFilters.at(-1), {
    status: 'Available',
    type: { $in: ['Residential', 'House & Lot', 'Condominium'] },
  }));
  check(() => assert.deepEqual(
    buyerRes.properties.map((p) => p.type),
    ['Residential', 'House & Lot', 'Condominium']
  ));
  check(() => assert.equal(recordedEvents.at(-1)?.propertyType, 'Residential'));
  check(() => assert.equal(recordedEvents.at(-1)?.resultCount, 3));

  // Anonymous Residential search also expands via $in and stays Available-only
  const anonRes = await getAllProperties({ type: 'Residential', limit: 100 });
  check(() => assert.deepEqual(seenFilters.at(-1), {
    status: 'Available',
    type: { $in: ['Residential', 'House & Lot', 'Condominium'] },
  }));
  check(() => assert.deepEqual(
    anonRes.properties.map((p) => p.type),
    ['Residential', 'House & Lot', 'Condominium']
  ));

  // Buyer specific subtype filters remain exact
  const buyerHL = await getAllProperties({ type: 'House & Lot', limit: 100 }, { role: 'buyer' });
  check(() => assert.deepEqual(seenFilters.at(-1), { status: 'Available', type: 'House & Lot' }));
  check(() => assert.deepEqual(buyerHL.properties.map((p) => p.type), ['House & Lot']));

  const buyerCondo = await getAllProperties({ type: 'Condominium', limit: 100 }, { role: 'buyer' });
  check(() => assert.deepEqual(seenFilters.at(-1), { status: 'Available', type: 'Condominium' }));
  check(() => assert.deepEqual(buyerCondo.properties.map((p) => p.type), ['Condominium']));

  // Admin Residential filter remains exact (no $in expansion, includes non-Available)
  const adminRes = await getAllProperties({ type: 'Residential', limit: 100 }, { role: 'admin' });
  check(() => assert.deepEqual(seenFilters.at(-1), { type: 'Residential' }));
  check(() => assert.deepEqual(
    adminRes.properties.map((p) => String(p._id)),
    ['p-res-avail', 'p-res-sold']
  ));

  console.log(`testResidentialCategoryMapping: PASS (${assertions} assertions)`);
} finally {
  Property.countDocuments = originalCountDocuments;
  Property.find = originalFind;
  Audit.aggregate = originalAuditAggregate;
  SearchEvent.create = originalSearchEventCreate;
}
