// TEMPORARY test script — not part of the deliverable. Mocks
// Property/User/Transaction model statics with controlled fake data, same
// approach as the other test*.mjs scripts.

import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import Property from './src/models/Property.js';
import User from './src/models/User.js';
import Audit from './src/models/Audit.js';
import Transaction from './src/models/Transaction.js';
import * as analyticsService from './src/services/analyticsService.js';
import * as activityService from './src/services/activityService.js';
import { getManilaYearBounds, getStartOfManilaMonth } from './src/utils/manilaTime.js';

const oid = () => new mongoose.Types.ObjectId();

function mockQuery(data) {
  const p = Promise.resolve(data);
  p.select = () => mockQuery(data);
  p.sort = () => mockQuery(data);
  p.limit = () => mockQuery(data);
  p.populate = () => mockQuery(data);
  return p;
}

Audit.aggregate = async () => [];

// ---- Scenario 1: getDashboardSummary reports real this-month counts ----
const now = new Date();
const thisMonthDate = now;
const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 15);

Property.countDocuments = async (filter) => {
  if (filter?.createdAt) return 2; // 2 properties created this month
  if (filter?.status === 'Available') return 3;
  if (filter?.status === 'Reserved') return 1;
  if (filter?.status === 'Sold') return 1;
  return 5;
};
User.countDocuments = async (filter) => {
  if (filter?.createdAt) return 3; // 3 buyers this month
  return 10;
};
Property.find = () => mockQuery([{ _id: oid(), price: 100000 }, { _id: oid(), price: 200000 }]);

const summary = await analyticsService.getDashboardSummary();
assert.equal(summary.propertiesAddedThisMonth, 2);
assert.equal(summary.buyersRegisteredThisMonth, 3);
assert.equal(summary.totalProperties, 5);
assert.equal(summary.totalBuyers, 10);
console.log('✅ Scenario 1 (getDashboardSummary reports real this-month counts) passed');

// ---- Scenario 2: getSalesPerformance computes Revenue YTD from completed transactions only ----
const { start: yearStart, end: yearEnd } = getManilaYearBounds();
const midYear = new Date(yearStart.getTime() + (yearEnd.getTime() - yearStart.getTime()) / 2);
const lastYear = new Date(yearStart.getTime() - 1000 * 60 * 60 * 24 * 30);

Property.find = () => mockQuery([{ price: 500000, updatedAt: midYear }]);
Transaction.aggregate = async (pipeline) => {
  const match = pipeline[0].$match;
  assert.equal(match.status, 'Completed');
  // Simulate: only transactions actually within [start, end) count.
  return [{ _id: null, total: 750000 }];
};

const sales = await analyticsService.getSalesPerformance();
assert.equal(sales.revenueYTD, 750000);
assert.equal(sales.revenueYTDSource, 'transactions');
assert.equal(sales.totalRevenue, 500000, 'existing Property-based totalRevenue must remain untouched');
console.log('✅ Scenario 2 (Revenue YTD sourced from completed Transactions, old fields untouched) passed');

// ---- Scenario 3: getSalesPerformance still returns revenueYTD even with zero Sold properties ----
Property.find = () => mockQuery([]);
Transaction.aggregate = async () => [{ _id: null, total: 300000 }];
const salesEmpty = await analyticsService.getSalesPerformance();
assert.equal(salesEmpty.totalRevenue, 0);
assert.equal(salesEmpty.revenueYTD, 300000, 'YTD must still be reported even when no properties are Sold yet');
console.log('✅ Scenario 3 (Revenue YTD present even on the zero-Sold-properties early return) passed');

// ---- Scenario 4: a completed transaction from a previous year is excluded ----
Property.find = () => mockQuery([{ price: 100, updatedAt: now }]);
let capturedFilter = null;
Transaction.aggregate = async (pipeline) => {
  capturedFilter = pipeline[0].$match;
  // A real aggregate would exclude lastYear's date automatically via the
  // $gte/$lt range — verify the range itself is this calendar year only.
  assert.ok(capturedFilter.completedAt.$gte >= yearStart);
  assert.ok(capturedFilter.completedAt.$lt <= yearEnd);
  return [{ _id: null, total: 0 }]; // nothing in range
};
const salesExcluding = await analyticsService.getSalesPerformance();
assert.equal(salesExcluding.revenueYTD, 0);
console.log('✅ Scenario 4 (year boundary excludes prior-year completions) passed');

// ---- Scenario 5: getRecentActivity classifies transaction events correctly ----
const propId = oid();
Property.find = () => mockQuery([{ name: 'Balayan Farm Lot', createdAt: now }]);
User.find = () => mockQuery([{ username: 'juan', createdAt: now }]);

const createdTxn = {
  reference: 'TXN-AAAAAA',
  status: 'Reserved',
  createdAt: now,
  updatedAt: now,
  completedAt: null,
  propertyId: { name: 'Balayan Farm Lot' },
};
const statusChangedTxn = {
  reference: 'TXN-BBBBBB',
  status: 'Processing',
  createdAt: new Date(now.getTime() - 60000),
  updatedAt: now,
  completedAt: null,
  propertyId: { name: 'Tagaytay Lot' },
};
const completedTxn = {
  reference: 'TXN-CCCCCC',
  status: 'Completed',
  createdAt: new Date(now.getTime() - 120000),
  updatedAt: now,
  completedAt: now,
  propertyId: { name: 'Green Meadows' },
};

Transaction.find = () => mockQuery([createdTxn, statusChangedTxn, completedTxn]);

const activity = await activityService.getRecentActivity(10);
const types = activity.map((a) => a.type);
assert.ok(types.includes('property_added'));
assert.ok(types.includes('buyer_registered'));
assert.ok(types.includes('transaction_created'));
assert.ok(types.includes('transaction_status_changed'));
assert.ok(types.includes('transaction_completed'));

const completedEvent = activity.find((a) => a.type === 'transaction_completed');
assert.match(completedEvent.description, /TXN-CCCCCC/);
assert.match(completedEvent.description, /Green Meadows/);
console.log('✅ Scenario 5 (recent activity correctly classifies created/changed/completed transactions) passed');

// ---- Scenario 6: activity feed respects the limit and stays sorted by recency ----
const many = Array.from({ length: 5 }, (_, i) => ({
  name: `Property ${i}`,
  createdAt: new Date(now.getTime() - i * 1000),
}));
Property.find = () => mockQuery(many);
User.find = () => mockQuery([]);
Transaction.find = () => mockQuery([]);

const limited = await activityService.getRecentActivity(3);
assert.equal(limited.length, 3);
assert.ok(new Date(limited[0].timestamp) >= new Date(limited[1].timestamp));
assert.ok(new Date(limited[1].timestamp) >= new Date(limited[2].timestamp));
console.log('✅ Scenario 6 (activity feed respects limit and stays sorted by recency) passed');

// ---- Scenario 7: Manila month/year boundaries are self-consistent ----
const monthStart = getStartOfManilaMonth(thisMonthDate);
assert.ok(monthStart <= thisMonthDate);
const bounds = getManilaYearBounds(thisMonthDate);
assert.ok(bounds.start <= thisMonthDate && thisMonthDate < bounds.end);
assert.ok(bounds.start > new Date(thisMonthDate.getFullYear() - 1, 11, 31), 'year start should not leak into the prior year');
console.log('✅ Scenario 7 (Manila month/year boundary helpers are self-consistent) passed');

console.log('\nALL DASHBOARD INTEGRATION TESTS PASSED ✅');
