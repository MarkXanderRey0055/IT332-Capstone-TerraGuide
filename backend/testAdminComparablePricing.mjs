import assert from 'node:assert/strict';
import Property from './src/models/Property.js';
import Audit from './src/models/Audit.js';
import User from './src/models/User.js';
import BuyerPreference from './src/models/BuyerPreference.js';
import Transaction from './src/models/Transaction.js';
import { getPropertyRankings, getPortfolioSnapshot } from './src/services/analyticsService.js';
import { getPropertyRankings as getPropertyRankingsHandler } from './src/controllers/AnalyticsController.js';

let assertions = 0;
function check(fn) {
  fn();
  assertions += 1;
}

const originalPropertyFind = Property.find;
const originalPropertyCountDocuments = Property.countDocuments;
const originalPropertyAggregate = Property.aggregate;
const originalAuditAggregate = Audit.aggregate;
const originalUserFind = User.find;
const originalUserCountDocuments = User.countDocuments;
const originalPrefFind = BuyerPreference.find;
const originalTransactionFind = Transaction.find;
const originalTransactionAggregate = Transaction.aggregate;

function makeQuery(rows) {
  const promise = Promise.resolve(rows);
  promise.select = () => Promise.resolve(rows);
  promise.lean = () => Promise.resolve(rows);
  return promise;
}

const fixtureProperties = [
  // Two Available Residential listings with different prices (cases a, c)
  { _id: 'res-low', name: 'Res Low', type: 'Residential', location: 'Lipa', status: 'Available', price: 1_000_000 },
  { _id: 'res-high', name: 'Res High', type: 'Residential', location: 'Lipa', status: 'Available', price: 1_500_000 },
  // Solo Available House & Lot listing — must NOT be pooled with Residential peers
  { _id: 'hl-solo', name: 'HL Solo', type: 'House & Lot', location: 'Lipa', status: 'Available', price: 4_000_000 },
  // Solo Commercial listing with no same-type peer (case b)
  { _id: 'com-solo', name: 'Com Solo', type: 'Commercial', location: 'Batangas', status: 'Available', price: 3_000_000 },
  // Available Agricultural + Sold and Reserved Agricultural listings (case d)
  { _id: 'agri-avail', name: 'Agri Avail', type: 'Agricultural', location: 'Nasugbu', status: 'Available', price: 2_000_000 },
  { _id: 'agri-sold', name: 'Agri Sold', type: 'Agricultural', location: 'Nasugbu', status: 'Sold', price: 500_000 },
  { _id: 'agri-res', name: 'Agri Res', type: 'Agricultural', location: 'Nasugbu', status: 'Reserved', price: 500_000 },
];

const fixtureAudits = fixtureProperties.map((p) => ({
  _id: p._id,
  audit: {
    propertyId: p._id,
    documentCompleteness: 80,
    complianceScore: 80,
    generatedAt: new Date('2026-11-20T00:00:00Z'),
  },
}));

try {
  const seenPropertyFilters = [];

  Property.find = (filter = {}) => {
    seenPropertyFilters.push(filter);
    const filtered = fixtureProperties.filter((p) => !filter.status || p.status === filter.status);
    return makeQuery(filtered);
  };
  Property.countDocuments = async () => fixtureProperties.length;
  Property.aggregate = async () => [{ _id: null, total: 8_500_000 }];
  Audit.aggregate = async () => fixtureAudits;
  User.find = async () => [];
  User.countDocuments = async () => 0;
  BuyerPreference.find = async () => [];
  Transaction.find = () => makeQuery([]);
  Transaction.aggregate = async () => [];

  // Run admin comparable pricing
  const result = await getPropertyRankings({ useComparablePricing: true });
  const byId = Object.fromEntries(result.rankings.map((r) => [r.propertyId, r]));

  // Case a & c: Two Available Residential listings exclude self from peers
  // res-low (1.0M) vs peer [1.5M] -> round((1.5M / 1.0M) * 100) = 150 -> clamped 100
  // res-high (1.5M) vs peer [1.0M] -> round((1.0M / 1.5M) * 100) = 67 (if self included, would be 83)
  check(() => assert.equal(byId['res-low'].priceCompetitivenessScore, 100));
  check(() => assert.equal(byId['res-high'].priceCompetitivenessScore, 67));
  check(() => assert.notEqual(byId['res-low'].priceCompetitivenessScore, 50));
  check(() => assert.notEqual(byId['res-high'].priceCompetitivenessScore, 50));
  check(() => assert.equal(byId['res-low'].marketReadinessScore, Math.round(80 * 0.6 + 100 * 0.4)));
  check(() => assert.equal(byId['res-high'].marketReadinessScore, Math.round(80 * 0.6 + 67 * 0.4)));

  // Case b: Solo Commercial and solo House & Lot listings keep neutral fallback of 50
  // (House & Lot is NOT pooled with Residential peers)
  check(() => assert.equal(byId['hl-solo'].priceCompetitivenessScore, 50));
  check(() => assert.equal(byId['hl-solo'].priceComparison, 'neutral: no comparable listings'));
  check(() => assert.equal(byId['hl-solo'].marketReadinessScore, Math.round(80 * 0.6 + 50 * 0.4)));
  check(() => assert.equal(byId['com-solo'].priceCompetitivenessScore, 50));
  check(() => assert.equal(byId['com-solo'].priceComparison, 'neutral: no comparable listings'));
  check(() => assert.equal(byId['com-solo'].marketReadinessScore, Math.round(80 * 0.6 + 50 * 0.4)));

  // Case d: Sold and Reserved Agricultural listings are NOT used as peers
  // If 500k Sold/Reserved were included, agri-avail (2M) would score 25; excluding them yields neutral 50
  check(() => assert.equal(byId['agri-avail'].priceCompetitivenessScore, 50));
  check(() => assert.equal(byId['agri-avail'].priceComparison, 'neutral: no comparable listings'));

  // Case e (controller): AnalyticsController.getPropertyRankings invokes comparable pricing
  seenPropertyFilters.length = 0;
  let controllerPayload = null;
  const mockRes = {
    status() {
      return this;
    },
    json(payload) {
      controllerPayload = payload;
      return this;
    },
  };
  await new Promise((resolve, reject) => {
    getPropertyRankingsHandler({}, mockRes, (err) => (err ? reject(err) : resolve()));
    setImmediate(resolve);
  });
  check(() => assert.ok(seenPropertyFilters.some((f) => f.status === 'Available')));
  const ctrlById = Object.fromEntries(controllerPayload.data.rankings.map((r) => [r.propertyId, r]));
  check(() => assert.equal(ctrlById['res-high'].priceCompetitivenessScore, 67));

  // Case e (snapshot): getPortfolioSnapshot passes comparable pricing (queries Available peers)
  seenPropertyFilters.length = 0;
  await getPortfolioSnapshot();
  check(() => assert.ok(seenPropertyFilters.some((f) => f.status === 'Available')));

  console.log(`testAdminComparablePricing: PASS (${assertions} assertions)`);
} finally {
  Property.find = originalPropertyFind;
  Property.countDocuments = originalPropertyCountDocuments;
  Property.aggregate = originalPropertyAggregate;
  Audit.aggregate = originalAuditAggregate;
  User.find = originalUserFind;
  User.countDocuments = originalUserCountDocuments;
  BuyerPreference.find = originalPrefFind;
  Transaction.find = originalTransactionFind;
  Transaction.aggregate = originalTransactionAggregate;
}
