import assert from 'node:assert/strict';
import Property from './src/models/Property.js';
import Audit from './src/models/Audit.js';
import BuyerPreference from './src/models/BuyerPreference.js';
import User from './src/models/User.js';
import Inquiry from './src/models/Inquiry.js';
import { getAllProperties } from './src/services/propertyService.js';
import { getBuyerMarketTrends } from './src/services/analyticsService.js';
import { getInquiriesForBuyer } from './src/services/inquiryService.js';
import { BUYER_VISIBLE_PROPERTY_STATUS } from '../shared/propertyVisibility.mjs';

const fixtures = ['Available', 'Reserved', 'Sold'].map((status, index) => ({
  _id: `property-${index}`,
  name: `${status} listing`,
  type: 'Residential',
  location: 'Batangas',
  status,
  price: 1000000,
  lat: 14,
  lng: 121,
}));
let seenPropertyFilters = [];

Property.countDocuments = async (filter) => fixtures.filter((item) => {
  if (filter.status && item.status !== filter.status) return false;
  return true;
}).length;
Property.find = (filter = {}) => {
  seenPropertyFilters.push(filter);
  const rows = fixtures.filter((item) => !filter.status || item.status === filter.status);
  let offset = 0;
  let max = rows.length;
  const query = {
    populate() { return this; },
    sort() { return this; },
    skip(value) { offset = value; return this; },
    limit(value) { max = value; return this; },
    then(resolve, reject) { return Promise.resolve(rows.slice(offset, offset + max)).then(resolve, reject); },
  };
  return query;
};

const buyerList = await getAllProperties({ status: 'Sold', limit: 100 }, { role: 'buyer' });
assert.deepEqual(buyerList.properties.map((item) => item.status), [BUYER_VISIBLE_PROPERTY_STATUS]);
assert.deepEqual(seenPropertyFilters.at(-1), { status: BUYER_VISIBLE_PROPERTY_STATUS }, 'buyer-supplied status is ignored');

const anonymousList = await getAllProperties({ limit: 100 });
assert.deepEqual(anonymousList.properties.map((item) => item.status), [BUYER_VISIBLE_PROPERTY_STATUS]);
assert.deepEqual(seenPropertyFilters.at(-1), { status: BUYER_VISIBLE_PROPERTY_STATUS });

Audit.aggregate = async () => [];
const adminList = await getAllProperties({ limit: 100 }, { role: 'admin' });
assert.deepEqual(adminList.properties.map((item) => item.status), ['Available', 'Reserved', 'Sold']);
assert.deepEqual(seenPropertyFilters.at(-1), {}, 'admin list remains unrestricted by default');
const adminReservedList = await getAllProperties({ status: 'Reserved', limit: 100 }, { role: 'admin' });
assert.deepEqual(adminReservedList.properties.map((item) => item.status), ['Reserved']);
assert.deepEqual(seenPropertyFilters.at(-1), { status: 'Reserved' }, 'admin status filter is honored');

Audit.aggregate = async () => fixtures.map((property) => ({
  _id: property._id,
  audit: { complianceScore: 80, comparisonAverage: 1000000 },
}));
User.find = async () => [];
BuyerPreference.find = async () => [];
const trends = await getBuyerMarketTrends(10);
assert.deepEqual(trends.topListings.map((item) => item.status), ['Available']);
assert.deepEqual(seenPropertyFilters.at(-1), { status: BUYER_VISIBLE_PROPERTY_STATUS }, 'buyer rankings query only Available properties');

const reservedHistoricalProperty = { _id: 'property-1', name: 'Reserved listing', status: 'Reserved' };
const inquiryRecord = { propertyId: reservedHistoricalProperty, buyerId: 'buyer-1' };
Inquiry.find = () => ({
  populate() { return this; },
  sort() { return Promise.resolve([inquiryRecord]); },
});
const inquiries = await getInquiriesForBuyer('buyer-1');
assert.equal(inquiries[0].propertyId.status, 'Reserved', 'historical inquiry retains its populated property');

console.log('Buyer visibility backend tests passed (buyer/anonymous list, admin list, buyer rankings, historical inquiry).');
