// TEMPORARY test script — not part of the deliverable, used only to verify
// the AI Usage Quota / RPM Protection logic without a live MongoDB
// connection. Monkey-patches AIUsage/AIRateLimit model statics with
// controlled fake data, same approach as the other test*.mjs scripts.

import assert from 'node:assert/strict';
import AIUsage from './src/models/AIUsage.js';
import AIRateLimit from './src/models/AIRateLimit.js';
import * as aiUsageService from './src/services/aiUsageService.js';

// In-memory fakes standing in for the two collections, so the atomic
// findOneAndUpdate semantics can actually be exercised (including the
// "second concurrent call sees the already-incremented value" behavior)
// rather than just mocked with canned return values.
let fakeUsageDocs = new Map(); // date -> record
let fakeWindowDocs = new Map(); // windowId -> record

function installFakes() {
  fakeUsageDocs = new Map();
  fakeWindowDocs = new Map();

  AIUsage.findOneAndUpdate = async (filter, update, options) => {
    let doc = fakeUsageDocs.get(filter.date);

    if (!doc) {
      if (!options?.upsert) return null;
      doc = { date: filter.date, totalRequests: 0, complianceRequests: 0, portfolioRequests: 0, marketInsightRequests: 0 };
      if (update.$setOnInsert) Object.assign(doc, update.$setOnInsert);
      fakeUsageDocs.set(filter.date, doc);
      return doc;
    }

    // Enforce the $lt condition if present, exactly like Mongo would.
    if (filter.totalRequests?.$lt !== undefined && !(doc.totalRequests < filter.totalRequests.$lt)) {
      return null;
    }

    if (update.$inc) {
      for (const [key, val] of Object.entries(update.$inc)) {
        doc[key] = (doc[key] || 0) + val;
      }
    }
    return doc;
  };
  AIUsage.findOne = async (filter) => fakeUsageDocs.get(filter.date) || null;
  AIUsage.updateOne = async (filter, update) => {
    const doc = fakeUsageDocs.get(filter.date);
    if (doc && update.$inc) {
      for (const [key, val] of Object.entries(update.$inc)) {
        doc[key] = (doc[key] || 0) + val;
      }
    }
  };

  AIRateLimit.findOneAndUpdate = async (filter, update, options) => {
    let doc = fakeWindowDocs.get(filter.windowId);

    if (!doc) {
      if (!options?.upsert) return null;
      doc = { windowId: filter.windowId, count: 0 };
      if (update.$setOnInsert) Object.assign(doc, update.$setOnInsert);
      fakeWindowDocs.set(filter.windowId, doc);
      return doc;
    }

    if (filter.count?.$lt !== undefined && !(doc.count < filter.count.$lt)) {
      return null;
    }

    if (update.$inc) {
      for (const [key, val] of Object.entries(update.$inc)) {
        doc[key] = (doc[key] || 0) + val;
      }
    }
    return doc;
  };
  AIRateLimit.findOne = async (filter) => fakeWindowDocs.get(filter.windowId) || null;
}

// ---- Scenario 1: requests within both limits succeed and increment correctly ----
installFakes();
process.env.AI_DAILY_LIMIT = '50';
process.env.AI_RPM_LIMIT = '35';

await aiUsageService.reserveAiUsage('compliance');
await aiUsageService.reserveAiUsage('portfolio');
await aiUsageService.reserveAiUsage('market');

let status = await aiUsageService.getUsageStatus();
assert.equal(status.daily.used, 3);
assert.equal(status.daily.remaining, 47);
assert.equal(status.breakdown.compliance, 1);
assert.equal(status.breakdown.portfolio, 1);
assert.equal(status.breakdown.market, 1);
assert.equal(status.rpm.current, 3);
console.log('✅ Scenario 1 (usage across all three features tracked independently) passed');

// ---- Scenario 2: daily quota blocks the request that would exceed it, before "calling NVIDIA" ----
installFakes();
process.env.AI_DAILY_LIMIT = '3';
process.env.AI_RPM_LIMIT = '35';

await aiUsageService.reserveAiUsage('compliance'); // 1/3
await aiUsageService.reserveAiUsage('portfolio');  // 2/3
await aiUsageService.reserveAiUsage('market');     // 3/3

await assert.rejects(
  () => aiUsageService.reserveAiUsage('compliance'),
  (err) => {
    assert.equal(err.statusCode, 429);
    assert.equal(err.details.error, 'AI_DAILY_LIMIT_REACHED');
    assert.equal(err.details.used, 3);
    assert.equal(err.details.limit, 3);
    assert.equal(err.details.remaining, 0);
    assert.ok(err.details.resetAt);
    return true;
  }
);

status = await aiUsageService.getUsageStatus();
assert.equal(status.daily.used, 3, 'the rejected 4th request must not have incremented the counter');
console.log('✅ Scenario 2 (daily quota enforced exactly at the limit, rejection does not increment) passed');

// ---- Scenario 3: RPM limit blocks a request and refunds the daily unit it had reserved ----
installFakes();
process.env.AI_DAILY_LIMIT = '50';
process.env.AI_RPM_LIMIT = '2';

await aiUsageService.reserveAiUsage('compliance'); // rpm 1/2
await aiUsageService.reserveAiUsage('portfolio');  // rpm 2/2

await assert.rejects(
  () => aiUsageService.reserveAiUsage('market'),
  (err) => {
    assert.equal(err.statusCode, 429);
    assert.equal(err.details.error, 'AI_RATE_LIMIT_REACHED');
    assert.equal(err.details.limit, 2);
    assert.ok(typeof err.details.retryAfter === 'number');
    return true;
  }
);

status = await aiUsageService.getUsageStatus();
assert.equal(
  status.daily.used,
  2,
  'the RPM-rejected request must not consume a daily unit — only the 2 successful requests should count'
);
console.log('✅ Scenario 3 (RPM limit enforced independently, and refunds the daily unit on rejection) passed');

// ---- Scenario 4: concurrent requests at the boundary cannot both succeed (no 51/50) ----
installFakes();
process.env.AI_DAILY_LIMIT = '1';
process.env.AI_RPM_LIMIT = '35';

const results = await Promise.allSettled([
  aiUsageService.reserveAiUsage('compliance'),
  aiUsageService.reserveAiUsage('portfolio'),
]);

const succeeded = results.filter((r) => r.status === 'fulfilled').length;
const failed = results.filter((r) => r.status === 'rejected').length;
assert.equal(succeeded, 1, 'exactly one of the two concurrent requests should succeed');
assert.equal(failed, 1, 'exactly one of the two concurrent requests should be rejected');

status = await aiUsageService.getUsageStatus();
assert.equal(status.daily.used, 1, 'concurrent requests must never push the counter past the limit');
console.log('✅ Scenario 4 (concurrent requests at the limit boundary cannot both succeed) passed');

// ---- Scenario 5: unknown feature identifier is rejected cleanly ----
installFakes();
await assert.rejects(
  () => aiUsageService.reserveAiUsage('not-a-real-feature'),
  /Unknown AI feature identifier/
);
console.log('✅ Scenario 5 (unknown feature identifier rejected with a clear error) passed');

// ---- Scenario 6: fallback defaults apply when env vars are missing/invalid ----
installFakes();
delete process.env.AI_DAILY_LIMIT;
delete process.env.AI_RPM_LIMIT;

status = await aiUsageService.getUsageStatus();
assert.equal(status.daily.limit, 50, 'missing AI_DAILY_LIMIT should fall back to 50');
assert.equal(status.rpm.limit, 35, 'missing AI_RPM_LIMIT should fall back to 35');
console.log('✅ Scenario 6 (sensible fallback defaults when .env values are missing) passed');

console.log('\nALL AI USAGE QUOTA TESTS PASSED ✅');
