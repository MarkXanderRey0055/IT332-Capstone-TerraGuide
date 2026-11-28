import assert from 'node:assert/strict';
import User from './src/models/User.js';
import BuyerPreference from './src/models/BuyerPreference.js';
import { getBuyerIntelligence } from './src/services/analyticsService.js';

const originalUserFind = User.find;
const originalPrefFind = BuyerPreference.find;

const users = [
  { _id: 'buyer-a', role: 'buyer' },
  { _id: 'buyer-b', role: 'buyer' },
  { _id: 'buyer-c', role: 'buyer' },
  { _id: 'buyer-d', role: 'buyer' },
  { _id: 'admin-1', role: 'admin' },
];

const allPreferences = [
  // a. Buyer A: valid range
  { userId: 'buyer-a', budgetMin: 1_000_000, budgetMax: 3_000_000, landType: 'Residential', location: 'Lipa' },
  // b. Buyer B: valid range
  { userId: 'buyer-b', budgetMin: 2_000_000, budgetMax: 4_000_000, landType: 'Commercial', location: 'Balayan' },
  // c. Buyer C: one bound only
  { userId: 'buyer-c', budgetMin: 500_000, budgetMax: null, landType: 'Agricultural', location: 'Lipa' },
  // d. Buyer D: inverted range
  { userId: 'buyer-d', budgetMin: 3_000_000, budgetMax: 1_000_000, landType: 'Residential', location: 'Nasugbu' },
  // e. Orphan record: userId not in buyer list
  { userId: 'orphan-1', budgetMin: 10_000_000, budgetMax: 20_000_000, landType: 'Condominium', location: 'OrphanCity' },
  // f. Admin record: userId belongs to an admin
  { userId: 'admin-1', budgetMin: 15_000_000, budgetMax: 25_000_000, landType: 'House & Lot', location: 'AdminCity' },
];

try {
  let seenUserFilter = null;
  let seenUserProjection = null;
  let seenPrefFilter = null;

  User.find = async (filter = {}, projection = null) => {
    seenUserFilter = filter;
    seenUserProjection = projection;
    return users
      .filter((user) => !filter.role || user.role === filter.role)
      .map((user) => (projection?._id === 1 ? { _id: user._id } : user));
  };

  BuyerPreference.find = async (filter = {}) => {
    seenPrefFilter = filter;
    const allowedIds = filter.userId?.$in ? new Set(filter.userId.$in.map(String)) : null;
    return allPreferences.filter((pref) => !allowedIds || allowedIds.has(String(pref.userId)));
  };

  // Case 1: buyer-only scoping + valid-range averageBudget
  const result = await getBuyerIntelligence();
  assert.deepEqual(seenUserFilter, { role: 'buyer' }, 'User.find must filter by role: buyer');
  assert.deepEqual(seenUserProjection, { _id: 1 }, 'User.find must project _id only');
  assert.deepEqual(
    seenPrefFilter.userId.$in,
    ['buyer-a', 'buyer-b', 'buyer-c', 'buyer-d'],
    'BuyerPreference.find must scope userId to buyer account IDs'
  );

  assert.equal(result.totalBuyersWithPreferences, 4, 'only buyers A, B, C, D should be counted');
  assert.equal(result.buyersWithBothBudgetBounds, 2, 'only buyers A and B have valid positive non-inverted bounds');
  assert.equal(result.averageBudget, 2_500_000, 'averageBudget should be Math.round(((1M+3M)/2 + (2M+4M)/2) / 2) = 2,500,000');

  // Orphan and admin landType/location values must be excluded
  const types = result.preferredTypes.map((entry) => entry.label);
  const locations = result.preferredLocations.map((entry) => entry.label);
  assert.equal(types.includes('Condominium'), false, 'orphan landType must be excluded');
  assert.equal(types.includes('House & Lot'), false, 'admin landType must be excluded');
  assert.equal(locations.includes('OrphanCity'), false, 'orphan location must be excluded');
  assert.equal(locations.includes('AdminCity'), false, 'admin location must be excluded');

  // Case 2: no buyer preferences -> all counts 0, no crash
  BuyerPreference.find = async () => [];
  const emptyPrefsResult = await getBuyerIntelligence();
  assert.deepEqual(emptyPrefsResult, {
    budgetDistribution: [],
    preferredTypes: [],
    preferredLocations: [],
    averageBudget: 0,
    totalBuyersWithPreferences: 0,
    buyersWithBothBudgetBounds: 0,
  });

  // Case 2b: no buyer accounts -> all counts 0, no crash
  User.find = async () => [];
  const emptyBuyersResult = await getBuyerIntelligence();
  assert.deepEqual(emptyBuyersResult, {
    budgetDistribution: [],
    preferredTypes: [],
    preferredLocations: [],
    averageBudget: 0,
    totalBuyersWithPreferences: 0,
    buyersWithBothBudgetBounds: 0,
  });

  console.log('Buyer intelligence scope tests passed: buyer-only preferences, valid-range averageBudget, orphan/admin excluded, empty states handled.');
} finally {
  User.find = originalUserFind;
  BuyerPreference.find = originalPrefFind;
}
