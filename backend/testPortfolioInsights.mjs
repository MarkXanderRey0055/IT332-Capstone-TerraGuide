import assert from 'node:assert/strict';
import AIUsage from './src/models/AIUsage.js';
import AIRateLimit from './src/models/AIRateLimit.js';
import { generatePortfolioNarrative, validatePortfolioNarrative } from './src/services/aiService.js';
import {
  createDeterministicPortfolioInsights,
  createPortfolioFallbackResult,
  createPortfolioInsightResult,
  getPortfolioFallbackReason,
} from './src/services/analyticsService.js';

const originalFetch = globalThis.fetch;
const originalKey = process.env.NVIDIA_API_KEY;
const originalMethods = {
  usageFindOneAndUpdate: AIUsage.findOneAndUpdate,
  usageUpdateOne: AIUsage.updateOne,
  rateFindOneAndUpdate: AIRateLimit.findOneAndUpdate,
  rateUpdateOne: AIRateLimit.updateOne,
};

let daily;
let rpm;
const resetRecords = () => {
  daily = null;
  rpm = null;
};

AIUsage.findOneAndUpdate = async (filter, update) => {
  if (!daily) daily = { date: filter.date, totalRequests: 0, portfolioRequests: 0 };
  if (update.$setOnInsert) return daily;
  if (daily.totalRequests >= filter.totalRequests.$lt) return null;
  daily.totalRequests += update.$inc.totalRequests;
  daily.portfolioRequests += update.$inc.portfolioRequests;
  return daily;
};
AIUsage.updateOne = async (filter, update) => {
  if (daily && daily.totalRequests > 0 && daily.portfolioRequests > 0) {
    daily.totalRequests += update.$inc.totalRequests;
    daily.portfolioRequests += update.$inc.portfolioRequests;
  }
  return { modifiedCount: 1 };
};
AIRateLimit.findOneAndUpdate = async (filter, update) => {
  if (!rpm) rpm = { windowId: filter.windowId, count: 0 };
  if (update.$setOnInsert) return rpm;
  if (rpm.count >= filter.count.$lt) return null;
  rpm.count += update.$inc.count;
  return rpm;
};
AIRateLimit.updateOne = async (filter, update) => {
  if (rpm && rpm.count > 0) rpm.count += update.$inc.count;
  return { modifiedCount: 1 };
};

const fields = ['portfolioHealth', 'marketTrends', 'buyerBehavior', 'topPerformingCategories', 'risks', 'recommendations'];
const validNarrative = Object.fromEntries(fields.map((field) => [field, `Recorded snapshot insight for ${field}.`]));
const snapshot = {
  summary: {
    totalProperties: 12, availableProperties: 7, reservedProperties: 3, soldProperties: 2,
    totalBuyers: 18, estimatedPortfolioValue: 1250000, averageComplianceScore: 74,
    auditedPropertiesCount: 8,
  },
  riskCounts: { High: 2, Medium: 3, Low: 3, NotAudited: 4 },
  buyerIntelligence: {
    topPreferredType: 'Residential', topPreferredLocation: 'Lipa', averageBudget: 900000,
    totalBuyersWithPreferences: 10,
  },
  salesPerformance: {
    totalRevenue: 100000, monthlyAverage: 25000, forecastNextMonth: 30000, note: '',
  },
};

function providerResponse(content) {
  return { ok: true, json: async () => ({ choices: [{ message: { content } }] }) };
}

try {
  process.env.NVIDIA_API_KEY = 'test-key';
  const failureCases = [
    ['provider non-2xx', async () => ({ ok: false, status: 500 })],
    ['provider authorization', async () => ({ ok: false, status: 401 })],
    ['network', async () => { throw new TypeError('offline'); }],
    ['timeout', async (_url, options) => {
      assert.ok(options.signal instanceof AbortSignal, 'Portfolio request must have an abort signal');
      throw Object.assign(new Error('timed out'), { name: 'TimeoutError' });
    }],
    ['non-JSON body', async () => ({ ok: true, json: async () => { throw new SyntaxError('invalid JSON'); } })],
    ['empty content', async () => providerResponse('  ')],
    ['JSON parse failure', async () => providerResponse('{broken')],
    ['missing required field', async () => providerResponse(JSON.stringify({ ...validNarrative, risks: undefined }))],
    ['empty required string', async () => providerResponse(JSON.stringify({ ...validNarrative, risks: '  ' }))],
    ['empty array instead of required paragraph', async () => providerResponse(JSON.stringify({ ...validNarrative, risks: [] }))],
  ];

  for (const [label, fetchMock] of failureCases) {
    resetRecords();
    globalThis.fetch = fetchMock;
    await assert.rejects(() => generatePortfolioNarrative(snapshot), undefined, label);
    assert.equal(daily.totalRequests, 0, `${label}: daily count should be refunded`);
    assert.equal(daily.portfolioRequests, 0, `${label}: portfolio count should be refunded`);
    assert.equal(rpm.count, 0, `${label}: RPM count should be refunded`);
  }

  resetRecords();
  globalThis.fetch = async () => providerResponse(JSON.stringify(validNarrative));
  assert.deepEqual(await generatePortfolioNarrative(snapshot), validNarrative);
  assert.equal(daily.totalRequests, 1, 'successful call keeps its daily usage');
  assert.equal(rpm.count, 1, 'successful call keeps its RPM usage');

  assert.throws(
    () => validatePortfolioNarrative({ ...validNarrative, risks: [] }),
    (error) => error.code === 'AI_INVALID_RESPONSE' && error.validationRule === 'PORTFOLIO_RISKS'
  );

  const fallback = createDeterministicPortfolioInsights(snapshot);
  assert.deepEqual(Object.keys(fallback).sort(), [...fields].sort());
  for (const field of fields) assert.ok(typeof fallback[field] === 'string' && fallback[field].trim());
  assert.match(fallback.portfolioHealth, /12 properties/);
  assert.match(fallback.risks, /2 high/);
  assert.match(fallback.buyerBehavior, /Residential/);
  assert.match(fallback.marketTrends, /₱100,000/);

  assert.equal(getPortfolioFallbackReason(Object.assign(new Error(), { code: 'AI_TIMEOUT', aiCategory: 'timeout' })), 'AI_TIMEOUT');
  assert.equal(getPortfolioFallbackReason(Object.assign(new Error(), { code: 'AI_INVALID_RESPONSE', aiCategory: 'validation' })), 'AI_INVALID_RESPONSE');
  assert.equal(getPortfolioFallbackReason(Object.assign(new Error(), { code: 'AI_NETWORK_ERROR', aiCategory: 'network' })), 'AI_UNAVAILABLE');
  assert.equal(createPortfolioFallbackResult(snapshot, Object.assign(new Error(), { code: 'AI_TIMEOUT', aiCategory: 'timeout' })).narrativeOrigin, 'SYSTEM_FALLBACK');
  assert.equal(createPortfolioFallbackResult(snapshot, Object.assign(new Error(), { code: 'AI_TIMEOUT', aiCategory: 'timeout' })).fallbackReason, 'AI_TIMEOUT');
  assert.equal(createPortfolioFallbackResult(snapshot, Object.assign(new Error(), { code: 'AI_INVALID_RESPONSE', aiCategory: 'validation' })).fallbackReason, 'AI_INVALID_RESPONSE');
  assert.equal(createPortfolioFallbackResult(snapshot, new Error('provider unavailable')).fallbackReason, 'AI_UNAVAILABLE');
  assert.equal(createPortfolioInsightResult(snapshot, validNarrative).narrativeOrigin, 'AI_GENERATED');
  assert.throws(() => validatePortfolioNarrative({ ...validNarrative, portfolioHealth: '' }), /non-empty/);

  console.log('Portfolio Insights reservation, validation, and deterministic fallback tests passed.');
} finally {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.NVIDIA_API_KEY;
  else process.env.NVIDIA_API_KEY = originalKey;
  AIUsage.findOneAndUpdate = originalMethods.usageFindOneAndUpdate;
  AIUsage.updateOne = originalMethods.usageUpdateOne;
  AIRateLimit.findOneAndUpdate = originalMethods.rateFindOneAndUpdate;
  AIRateLimit.updateOne = originalMethods.rateUpdateOne;
}
