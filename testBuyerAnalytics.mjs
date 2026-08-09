// TEMPORARY test script — not part of the deliverable, used only to
// verify Buyer Decision Analytics logic without a live MongoDB/NVIDIA
// connection. Monkey-patches the Mongoose model statics with controlled
// fake data, and stubs global fetch for the NVIDIA NIM call.

import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import Property from './src/models/Property.js';
import User from './src/models/User.js';
import BuyerPreference from './src/models/BuyerPreference.js';
import Audit from './src/models/Audit.js';

const oid = () => new mongoose.Types.ObjectId();

// Mongoose queries are chainable + thenable (e.g. Property.find().select(...)).
// This tiny helper mocks that shape so Property.find() can be chained with
// .select() just like the real analyticsService.js code does.
function mockQuery(data) {
  const promise = Promise.resolve(data);
  promise.select = () => mockQuery(data);
  return promise;
}

const propA = { _id: oid(), name: 'Balayan Farm Lot', type: 'Agricultural', location: 'Balayan, Batangas', status: 'Available', price: 2000000 };
const propB = { _id: oid(), name: 'Tagaytay Residential', type: 'Residential', location: 'Tagaytay', status: 'Available', price: 4500000 };
const propC = { _id: oid(), name: 'Makati Commercial Unit', type: 'Commercial', location: 'Makati', status: 'Reserved', price: 8000000 };

const auditA = { propertyId: propA._id, complianceScore: 90, missingItems: [], comparisonAverage: 2100000, generatedAt: new Date() };
const auditB = { propertyId: propB._id, complianceScore: 60, missingItems: ['tax'], comparisonAverage: 4000000, generatedAt: new Date() };
const auditC = { propertyId: propC._id, complianceScore: 30, missingItems: ['deed', 'survey'], comparisonAverage: 9000000, generatedAt: new Date() };

const buyerPrefs = [
  { userId: oid(), landType: 'Residential', location: 'Tagaytay', budgetMin: 3000000, budgetMax: 5000000 },
  { userId: oid(), landType: 'Residential', location: 'Cavite', budgetMin: 2000000, budgetMax: 4000000 },
  { userId: oid(), landType: 'Agricultural', location: 'Batangas', budgetMin: 1000000, budgetMax: 2500000 },
  { userId: oid(), landType: 'Commercial', location: 'Makati', budgetMin: 5000000, budgetMax: 9000000 },
];

// ---- Scenario 1: normal data ----
Property.find = (filter) => {
  if (filter && filter._id && filter._id.$in) {
    const ids = filter._id.$in.map(String);
    return mockQuery([propA, propB, propC].filter((p) => ids.includes(String(p._id))));
  }
  return mockQuery([propA, propB, propC]);
};
Property.countDocuments = async (filter) => {
  if (!filter) return 3;
  if (filter.status === 'Available') return 2;
  if (filter.status === 'Reserved') return 1;
  if (filter.status === 'Sold') return 0;
  return 3;
};
User.countDocuments = async () => 4;
BuyerPreference.find = async () => buyerPrefs;
Audit.aggregate = async () => [
  { _id: propA._id, audit: auditA },
  { _id: propB._id, audit: auditB },
  { _id: propC._id, audit: auditC },
];

const analyticsService = await import('./src/services/analyticsService.js');

const trends = await analyticsService.getBuyerMarketTrends(5);
console.log('getBuyerMarketTrends() ->', JSON.stringify(trends, null, 2));

// Percentages should sum to 100 (integer rounding) and be sorted descending
assert.equal(trends.trendingTypes.length, 3);
const totalPct = trends.trendingTypes.reduce((s, t) => s + t.percentage, 0);
assert.ok(totalPct >= 99 && totalPct <= 101, `percentages should sum to ~100, got ${totalPct}`);
assert.ok(
  trends.trendingTypes[0].percentage >= trends.trendingTypes[1].percentage,
  'trendingTypes should be sorted descending'
);

// Top listings should reuse marketReadinessScore (60% compliance + 40% price competitiveness)
assert.equal(trends.topListings.length, 3);
assert.ok(trends.topListings[0].rank === 1);
assert.ok(
  trends.topListings[0].marketScore >= trends.topListings[1].marketScore,
  'topListings should be sorted by marketScore descending'
);
console.log('✅ Scenario 1 (normal data) passed');

// ---- Scenario 2: empty data (no properties, no preferences) ----
Property.find = () => mockQuery([]);
Property.countDocuments = async () => 0;
BuyerPreference.find = async () => [];
Audit.aggregate = async () => [];

const emptyTrends = await analyticsService.getBuyerMarketTrends(5);
assert.deepEqual(emptyTrends.trendingTypes, []);
assert.deepEqual(emptyTrends.topListings, []);
console.log('✅ Scenario 2 (empty data) passed — no crash, empty arrays returned');

let threw = false;
try {
  await analyticsService.generateBuyerMarketInsight();
} catch (err) {
  threw = true;
  assert.equal(err.statusCode, 400);
  console.log('✅ Scenario 2b: generateBuyerMarketInsight() correctly throws a 400 AppError when there is no data:', err.message);
}
assert.ok(threw, 'generateBuyerMarketInsight should throw when totalProperties === 0');

// ---- Scenario 3: AI Market Insight generation (mocked NVIDIA call) ----
Property.find = (filter) => {
  if (filter && filter._id && filter._id.$in) {
    const ids = filter._id.$in.map(String);
    return mockQuery([propA, propB, propC].filter((p) => ids.includes(String(p._id))));
  }
  return mockQuery([propA, propB, propC]);
};
Property.countDocuments = async (filter) => {
  if (!filter) return 3;
  if (filter.status === 'Available') return 2;
  return 3;
};
BuyerPreference.find = async () => buyerPrefs;
Audit.aggregate = async () => [
  { _id: propA._id, audit: auditA },
  { _id: propB._id, audit: auditB },
  { _id: propC._id, audit: auditC },
];

process.env.NVIDIA_API_KEY = 'test-key-not-real';

const originalFetch = global.fetch;
global.fetch = async (url, options) => {
  assert.equal(url, 'https://integrate.api.nvidia.com/v1/chat/completions');
  const body = JSON.parse(options.body);
  assert.equal(body.model, 'meta/llama-3.1-8b-instruct');
  assert.ok(body.messages[1].content.includes('buyers browsing TerraGuide'), 'prompt should be buyer-facing');
  return {
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({
              summary:
                'Residential and Agricultural properties are drawing the most buyer interest this period. Two of three listings remain Available, suggesting healthy supply relative to demand. Buyers with budgets near the average may want to act while comparable listings remain on the market.',
            }),
          },
        },
      ],
    }),
  };
};

const result = await analyticsService.generateBuyerMarketInsight();
console.log('generateBuyerMarketInsight() ->', JSON.stringify(result, null, 2));
assert.ok(result.insight.summary.length > 0);
assert.equal(result.snapshot.totalProperties, 3);
console.log('✅ Scenario 3 (AI insight generation, mocked NVIDIA call) passed');

// ---- Scenario 4: AI returns malformed JSON -> should throw a clean error, not crash ----
global.fetch = async () => ({
  ok: true,
  json: async () => ({ choices: [{ message: { content: 'not valid json {{{' } }] }),
});
let threw2 = false;
try {
  await analyticsService.generateBuyerMarketInsight();
} catch (err) {
  threw2 = true;
  console.log('✅ Scenario 4: malformed AI JSON correctly surfaces as an error:', err.message);
}
assert.ok(threw2);

global.fetch = originalFetch;
console.log('\nALL BUYER DECISION ANALYTICS TESTS PASSED ✅');
process.exit(0);