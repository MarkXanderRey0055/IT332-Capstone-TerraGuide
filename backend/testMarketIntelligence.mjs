import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Property from './src/models/Property.js';
import Audit from './src/models/Audit.js';
import SearchEvent from './src/models/SearchEvent.js';
import { getAllProperties } from './src/services/propertyService.js';
import {
  calculateMarketReadinessScore,
  calculatePriceCompetitiveness,
  getPropertyRankings,
  SEARCH_METRIC_MIN_SAMPLE,
  summarizeSearchEvents,
} from './src/services/analyticsService.js';

const originalCount = Property.countDocuments;
const originalFind = Property.find;
const originalAggregate = Audit.aggregate;
const originalCreate = SearchEvent.create;

const propertyRows = [];
let audits = [];
const makeQuery = (rows) => ({
  populate() { return this; },
  sort() { return this; },
  skip() { return this; },
  limit() { return this; },
  select() { return this; },
  then(resolve, reject) { return Promise.resolve(rows).then(resolve, reject); },
});

Property.countDocuments = async (filter = {}) => propertyRows.filter((row) => !filter.status || row.status === filter.status).length;
Property.find = (filter = {}) => makeQuery(propertyRows.filter((row) => !filter.status || row.status === filter.status));
Audit.aggregate = async () => audits;

const savedEvents = [];
SearchEvent.create = async (event) => { savedEvents.push(event); return event; };
const result = await getAllProperties(
  { recordSearch: 'true', type: 'Residential', location: 'Lipa City', minPrice: '1000000' },
  { role: 'buyer', _id: 'buyer-id' }
);
assert.equal(savedEvents.length, 1, 'explicit filtered buyer search writes one event');
assert.equal(savedEvents[0].buyerId, 'buyer-id');
assert.equal(savedEvents[0].propertyType, 'Residential');
assert.equal(savedEvents[0].resultCount, result.pagination.total);

await getAllProperties({ recordSearch: 'true' }, { role: 'buyer', _id: 'buyer-id' });
await getAllProperties({ type: 'Residential' }, { role: 'buyer', _id: 'buyer-id' });
await getAllProperties({ recordSearch: 'true', type: 'Residential' }, { role: 'admin', _id: 'admin-id' });
assert.equal(savedEvents.length, 1, 'unfiltered, non-opted-in initial, and admin requests are not recorded');

SearchEvent.create = async () => { throw new Error('simulated storage failure'); };
const originalConsoleError = console.error;
console.error = () => {};
const successfulDespiteWriteFailure = await getAllProperties(
  { recordSearch: 'true', search: 'villa' },
  null
);
console.error = originalConsoleError;
assert.ok(successfulDespiteWriteFailure.pagination, 'a failed best-effort write does not fail the listing response');

const now = new Date('2026-11-23T00:00:00.000Z');
const fixedEvents = [
  [0, 500000], [1000000, 1500000], [2000000, 3000000], [4000000, 6000000], [6000001, 7000000],
  [0, 800000], [1200000, 1800000], [2500000, 3500000], [4500000, 5500000], [7000000, 9000000],
].map(([minPrice, maxPrice]) => ({
  createdAt: now,
  propertyType: 'Residential',
  location: '  Lipa   City ',
  minPrice,
  maxPrice,
}));
const metrics = summarizeSearchEvents(fixedEvents, now);
assert.equal(metrics.totalSearches, 10);
assert.equal(metrics.propertyTypes.eligibleSearches, 10);
assert.equal(metrics.propertyTypes.items.length, 5, 'all schema types, including zero-count types, are returned');
assert.equal(metrics.propertyTypes.items.find((item) => item.type === 'Residential').count, 10);
assert.equal(metrics.propertyTypes.items.find((item) => item.type === 'Condominium').count, 0);
assert.equal(metrics.popularLocations.items[0].location, 'Lipa');
assert.deepEqual(metrics.priceRanges.items.map((item) => item.count), [2, 2, 2, 2, 2]);
assert.ok(metrics.priceRanges.enoughSearches);
for (const metric of [metrics.propertyTypes, metrics.popularLocations, metrics.priceRanges]) {
  assert.ok(metric.items.every((item) => !Object.hasOwn(item, 'share')), 'search-metric response items omit share values');
}

const groupedTownLocations = summarizeSearchEvents([
  { createdAt: now, location: 'Purok 1 Talag, Lipa City, Batangas' },
  { createdAt: now, location: 'Lipa City, Batangas' },
], now);
assert.deepEqual(groupedTownLocations.popularLocations.items, [{ location: 'Lipa', count: 2 }]);

const unmatchedLocations = summarizeSearchEvents([
  { createdAt: now, location: '  Sitio Example, Unknown Municipality  ' },
  { createdAt: now, location: 'Sitio Example, Unknown Municipality' },
], now);
assert.deepEqual(unmatchedLocations.popularLocations.items, [{ location: 'Sitio Example, Unknown Municipality', count: 2 }]);

const buyerMarketIntelligenceSource = await readFile(
  new URL('../frontend/src/components/Buyer/BuyerMarketIntelligence.tsx', import.meta.url),
  'utf8'
);
assert.match(buyerMarketIntelligenceSource, /\{item\[labelKey\] \?\? 'Other'\}: \{item\.count\} searches\./);
assert.doesNotMatch(buyerMarketIntelligenceSource, /item\.share|% share/);

const sparse = summarizeSearchEvents(fixedEvents.slice(0, SEARCH_METRIC_MIN_SAMPLE - 1), now);
assert.equal(sparse.propertyTypes.enoughSearches, false, 'under-threshold metric is marked not enough');
assert.equal(sparse.propertyTypes.eligibleSearches, 4, 'four eligible events remain below the threshold');
assert.equal(sparse.propertyTypes.smallSample, false, 'under-threshold events do not show a small-sample results label');

const smallSample = summarizeSearchEvents(fixedEvents.slice(0, 5), now);
assert.equal(smallSample.propertyTypes.enoughSearches, true, 'five eligible events meet the threshold');
assert.equal(smallSample.propertyTypes.smallSample, true, 'five eligible events are labeled a small sample');
assert.equal(smallSample.propertyTypes.eligibleSearches, 5);

const sufficientSample = summarizeSearchEvents(fixedEvents, now);
assert.equal(sufficientSample.propertyTypes.enoughSearches, true, 'ten eligible events show results');
assert.equal(sufficientSample.propertyTypes.smallSample, false, 'ten eligible events do not show the small-sample label');

const lowListing = { _id: { toString: () => 'low' }, name: 'Lower priced', type: 'Residential', location: 'Lipa', status: 'Available', price: 1000000 };
const highListing = { _id: { toString: () => 'high' }, name: 'Higher priced', type: 'Residential', location: 'Lipa', status: 'Available', price: 3000000 };
propertyRows.splice(0, propertyRows.length, lowListing, highListing);
audits = [lowListing, highListing].map((property) => ({
  _id: property._id,
  audit: { complianceScore: 100 },
}));
const rankings = await getPropertyRankings({ availableOnly: true, useComparablePricing: true });
const lowRanked = rankings.rankings.find((entry) => entry.propertyId === 'low');
const highRanked = rankings.rankings.find((entry) => entry.propertyId === 'high');
assert.ok(lowRanked.marketReadinessScore > highRanked.marketReadinessScore);
assert.equal(lowRanked.priceComparison, null);

propertyRows.splice(0, propertyRows.length, lowListing);
audits = [{ _id: lowListing._id, audit: { complianceScore: 100 } }];
const noPeerRankings = await getPropertyRankings({ availableOnly: true, useComparablePricing: true });
assert.equal(noPeerRankings.rankings[0].priceCompetitivenessScore, 50);
assert.equal(noPeerRankings.rankings[0].priceComparison, 'neutral: no comparable listings');
assert.equal(calculatePriceCompetitiveness(100, [200]).score, 100);
assert.ok(calculatePriceCompetitiveness(200, [100]).score < calculatePriceCompetitiveness(100, [200]).score);
assert.equal(calculateMarketReadinessScore(100, 50), 80);

Property.countDocuments = originalCount;
Property.find = originalFind;
Audit.aggregate = originalAggregate;
SearchEvent.create = originalCreate;
console.log('Market intelligence tests passed: opted-in search capture, best-effort write, 30-day aggregation, sample threshold, peer pricing, and neutral fallback.');
