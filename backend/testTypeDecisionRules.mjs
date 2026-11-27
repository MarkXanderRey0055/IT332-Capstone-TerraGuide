import assert from 'node:assert/strict';
import {
  SHORTAGE_GAP_POINTS,
  SURPLUS_GAP_POINTS,
  MIN_BUYERS_FOR_DECISION,
  evaluateTypeDecisions,
} from './src/utils/typeDecisionRules.js';

let assertions = 0;
function check(fn) {
  fn();
  assertions += 1;
}

function byType(result, type) {
  return result.decisions.find((d) => d.type === type);
}

// Verify exported constants
check(() => assert.equal(SHORTAGE_GAP_POINTS, 15));
check(() => assert.equal(SURPLUS_GAP_POINTS, -15));
check(() => assert.equal(MIN_BUYERS_FOR_DECISION, 5));

// Main fixture: current dataset counts
const mainInput = {
  supplyByType: {
    Residential: { listings: 4, low: 3, medium: 1, high: 0, notAudited: 0 },
    Agricultural: { listings: 3, low: 2, medium: 1, high: 0, notAudited: 0 },
    Commercial: { listings: 3, low: 3, medium: 0, high: 0, notAudited: 0 },
    'House & Lot': { listings: 8, low: 3, medium: 0, high: 0, notAudited: 5 },
  },
  demandByType: {
    Residential: 7,
    Agricultural: 4,
    Commercial: 2,
    'House & Lot': 2,
  },
  nullDemandCount: 1,
};

const mainResult = evaluateTypeDecisions(mainInput);

// Check totals and ascending sort order
check(() => assert.equal(mainResult.demandTotal, 15));
check(() => assert.equal(mainResult.supplyTotal, 18));
check(() => assert.equal(mainResult.nullDemandCount, 1));
check(() =>
  assert.deepEqual(
    mainResult.decisions.map((d) => d.type),
    ['Agricultural', 'Commercial', 'House & Lot', 'Residential']
  )
);

// Case a: Residential
const res = byType(mainResult, 'Residential');
check(() => assert.equal(res.decision, 'shortage'));
check(() => assert.equal(res.blockingCount, 0));
check(() => assert.equal(res.unauditedCount, 0));
check(() => assert.equal(res.gapPointsDisplay, 24.4));
check(() => assert.ok(res.sentence.includes('Source or promote.')));

// Case b: Agricultural
const agri = byType(mainResult, 'Agricultural');
check(() => assert.equal(agri.decision, 'insufficient_sample'));
check(() => assert.equal(agri.gapPointsDisplay, 10.0));
check(() => assert.ok(agri.sentence.includes('no decision is made')));
check(() => assert.ok(!agri.sentence.includes('Source or promote')));
check(() => assert.ok(!agri.sentence.includes('Hold this type')));

// Case c: Commercial
const comm = byType(mainResult, 'Commercial');
check(() => assert.equal(comm.decision, 'insufficient_sample'));
check(() => assert.equal(comm.gapPointsDisplay, -3.3));

// Case d: House & Lot
const hl = byType(mainResult, 'House & Lot');
check(() => assert.equal(hl.decision, 'insufficient_sample'));
check(() => assert.equal(hl.gapPointsDisplay, -31.1));
check(() => assert.equal(hl.unauditedCount, 0));
check(() => assert.equal(hl.readiness.notAudited, 5));

// Case e: nullDemandCount does not change any demandShare (denominator stays 15)
check(() => assert.deepEqual(res.demandShare, { numerator: 7, denominator: 15 }));
check(() => assert.deepEqual(agri.demandShare, { numerator: 4, denominator: 15 }));
check(() => assert.deepEqual(comm.demandShare, { numerator: 2, denominator: 15 }));
check(() => assert.deepEqual(hl.demandShare, { numerator: 2, denominator: 15 }));

const mainWithLargerNull = evaluateTypeDecisions({ ...mainInput, nullDemandCount: 10 });
check(() => assert.equal(mainWithLargerNull.demandTotal, 15));
check(() => assert.deepEqual(byType(mainWithLargerNull, 'Residential').demandShare, { numerator: 7, denominator: 15 }));

// Case f: Shortage with a blocker (notAudited: 1 -> singular; notAudited: 2 -> plural)
const blockedResult = evaluateTypeDecisions({
  ...mainInput,
  supplyByType: {
    ...mainInput.supplyByType,
    Residential: { listings: 4, low: 2, medium: 1, high: 0, notAudited: 1 },
  },
});
const resBlocked = byType(blockedResult, 'Residential');
check(() => assert.equal(resBlocked.decision, 'shortage'));
check(() => assert.equal(resBlocked.blockingCount, 1));
check(() => assert.ok(resBlocked.sentence.includes('Complete document checks on 1 existing listing first')));

const blockedTwoResult = evaluateTypeDecisions({
  ...mainInput,
  supplyByType: {
    ...mainInput.supplyByType,
    Residential: { listings: 4, low: 1, medium: 1, high: 0, notAudited: 2 },
  },
});
const resBlockedTwo = byType(blockedTwoResult, 'Residential');
check(() => assert.equal(resBlockedTwo.blockingCount, 2));
check(() => assert.ok(resBlockedTwo.sentence.includes('Complete document checks on 2 existing listings first')));

// Case g: Medium does not block
const mediumResult = evaluateTypeDecisions({
  ...mainInput,
  supplyByType: {
    ...mainInput.supplyByType,
    Residential: { listings: 4, low: 0, medium: 4, high: 0, notAudited: 0 },
  },
});
const resMedium = byType(mediumResult, 'Residential');
check(() => assert.equal(resMedium.decision, 'shortage'));
check(() => assert.equal(resMedium.blockingCount, 0));
check(() => assert.equal(resMedium.readiness.medium, 4));

// Case h: Surplus with unaudited (A: 5/15 vs 15/20, gap = -41.7, notAudited = 2)
const surplusUnauditedResult = evaluateTypeDecisions({
  supplyByType: {
    A: { listings: 15, low: 13, medium: 0, high: 0, notAudited: 2 },
    B: { listings: 5, low: 5, medium: 0, high: 0, notAudited: 0 },
  },
  demandByType: { A: 5, B: 10 },
});
const surplusA = byType(surplusUnauditedResult, 'A');
check(() => assert.equal(surplusA.decision, 'surplus'));
check(() => assert.equal(surplusA.gapPointsDisplay, -41.7));
check(() => assert.equal(surplusA.unauditedCount, 2));
check(() => assert.ok(surplusA.sentence.includes('Audit 2 unaudited listings')));

const surplusOneUnauditedResult = evaluateTypeDecisions({
  supplyByType: {
    A: { listings: 15, low: 14, medium: 0, high: 0, notAudited: 1 },
    B: { listings: 5, low: 5, medium: 0, high: 0, notAudited: 0 },
  },
  demandByType: { A: 5, B: 10 },
});
check(() => assert.ok(byType(surplusOneUnauditedResult, 'A').sentence.includes('Audit 1 unaudited listing before')));

// Case i: Surplus clear (A: notAudited = 0)
const surplusClearResult = evaluateTypeDecisions({
  supplyByType: {
    A: { listings: 15, low: 15, medium: 0, high: 0, notAudited: 0 },
    B: { listings: 5, low: 5, medium: 0, high: 0, notAudited: 0 },
  },
  demandByType: { A: 5, B: 10 },
});
const surplusAClear = byType(surplusClearResult, 'A');
check(() => assert.equal(surplusAClear.decision, 'surplus'));
check(() => assert.equal(surplusAClear.unauditedCount, 0));
check(() => assert.ok(surplusAClear.sentence.includes('Hold this type.')));

// Case j: Exact boundary at +15.0 (shortage)
// T = 20, U = 20; X: D = 7, S = 4 -> diff100 = 100*(7*20 - 4*20) = 6000; threshold = 15*20*20 = 6000
const boundaryShortageResult = evaluateTypeDecisions({
  supplyByType: {
    X: { listings: 4, low: 4, medium: 0, high: 0, notAudited: 0 },
    Y: { listings: 16, low: 16, medium: 0, high: 0, notAudited: 0 },
  },
  demandByType: { X: 7, Y: 13 },
});
const boundaryXShortage = byType(boundaryShortageResult, 'X');
check(() => assert.equal(boundaryXShortage.decision, 'shortage'));
check(() => assert.equal(boundaryXShortage.gapPointsDisplay, 15.0));

// Case k: Exact boundary at -15.0 (surplus)
// T = 20, U = 20; X: D = 5, S = 8 -> diff100 = 100*(5*20 - 8*20) = -6000; threshold = -15*20*20 = -6000
const boundarySurplusResult = evaluateTypeDecisions({
  supplyByType: {
    X: { listings: 8, low: 8, medium: 0, high: 0, notAudited: 0 },
    Y: { listings: 12, low: 12, medium: 0, high: 0, notAudited: 0 },
  },
  demandByType: { X: 5, Y: 15 },
});
const boundaryXSurplus = byType(boundarySurplusResult, 'X');
check(() => assert.equal(boundaryXSurplus.decision, 'surplus'));
check(() => assert.equal(boundaryXSurplus.gapPointsDisplay, -15.0));

// Case k (sample check): Exact -15.0 boundary with 4 buyers (< MIN_BUYERS_FOR_DECISION) -> insufficient_sample
// T = 20, U = 20; X: D = 4, S = 7 -> diff100 = 100*(4*20 - 7*20) = -6000; threshold = -6000, but buyers = 4 < 5
const boundarySurplusLowSampleResult = evaluateTypeDecisions({
  supplyByType: {
    X: { listings: 7, low: 7, medium: 0, high: 0, notAudited: 0 },
    Y: { listings: 13, low: 13, medium: 0, high: 0, notAudited: 0 },
  },
  demandByType: { X: 4, Y: 16 },
});
const boundaryXSurplusLowSample = byType(boundarySurplusLowSampleResult, 'X');
check(() => assert.equal(boundaryXSurplusLowSample.decision, 'insufficient_sample'));
check(() => assert.equal(boundaryXSurplusLowSample.gapPointsDisplay, -15.0));

// Case l: Sample minimum overrides large positive gap (+40 points, buyers = 4)
// T = 5, U = 5; X: D = 4 (80%), S = 2 (40%) -> gap = +40.0, but buyers 4 < 5
const sampleMinResult = evaluateTypeDecisions({
  supplyByType: {
    X: { listings: 2, low: 2, medium: 0, high: 0, notAudited: 0 },
    Y: { listings: 3, low: 3, medium: 0, high: 0, notAudited: 0 },
  },
  demandByType: { X: 4, Y: 1 },
});
const sampleMinX = byType(sampleMinResult, 'X');
check(() => assert.equal(sampleMinX.decision, 'insufficient_sample'));
check(() => assert.equal(sampleMinX.gapPointsDisplay, 40.0));

// Case m: Insufficient data (demandByType empty, supplyByType non-empty)
const insufficientDataResult = evaluateTypeDecisions({
  supplyByType: {
    Residential: { listings: 4, low: 4, medium: 0, high: 0, notAudited: 0 },
    Commercial: { listings: 2, low: 2, medium: 0, high: 0, notAudited: 0 },
  },
  demandByType: {},
});
check(() => assert.equal(insufficientDataResult.demandTotal, 0));
check(() => assert.equal(insufficientDataResult.supplyTotal, 6));
check(() => assert.ok(insufficientDataResult.decisions.every((d) => d.decision === 'insufficient_data')));
check(() => assert.ok(insufficientDataResult.decisions.every((d) => d.gapPointsDisplay === null)));

// Additional check: no_records and within_range
const extraStatesResult = evaluateTypeDecisions({
  supplyByType: {
    Condominium: { listings: 0, low: 0, medium: 0, high: 0, notAudited: 0 },
    Residential: { listings: 5, low: 5, medium: 0, high: 0, notAudited: 0 },
    Commercial: { listings: 5, low: 5, medium: 0, high: 0, notAudited: 0 },
  },
  demandByType: { Condominium: 0, Residential: 5, Commercial: 5 },
});
check(() => assert.equal(byType(extraStatesResult, 'Condominium').decision, 'no_records'));
check(() =>
  assert.equal(
    byType(extraStatesResult, 'Condominium').sentence,
    'Condominium: no records in the current dataset.'
  )
);
check(() => assert.equal(byType(extraStatesResult, 'Residential').decision, 'within_range'));
check(() => assert.ok(byType(extraStatesResult, 'Residential').sentence.includes('Within range; no action.')));

// Case n: Validation throws TypeError naming the field
check(() =>
  assert.throws(
    () =>
      evaluateTypeDecisions({
        supplyByType: { A: { low: 1, medium: 0, high: 0, notAudited: 0 } },
        demandByType: { A: 1 },
      }),
    (err) => err instanceof TypeError && err.message.includes('listings')
  )
);
check(() =>
  assert.throws(
    () =>
      evaluateTypeDecisions({
        supplyByType: { A: { listings: 1, low: 1, medium: 0, high: 0, notAudited: 0 } },
        demandByType: { A: -1 },
      }),
    (err) => err instanceof TypeError && err.message.includes('demandByType.A')
  )
);
check(() =>
  assert.throws(
    () =>
      evaluateTypeDecisions({
        supplyByType: { A: { listings: 1.5, low: 1, medium: 0, high: 0, notAudited: 0 } },
        demandByType: { A: 1 },
      }),
    (err) => err instanceof TypeError && err.message.includes('listings')
  )
);
check(() =>
  assert.throws(
    () =>
      evaluateTypeDecisions({
        supplyByType: { A: { listings: 4, low: 1, medium: 1, high: 0, notAudited: 0 } },
        demandByType: { A: 1 },
      }),
    (err) => err instanceof TypeError && err.message.includes('listings')
  )
);
check(() =>
  assert.throws(
    () =>
      evaluateTypeDecisions({
        supplyByType: { A: { listings: 1, low: 1, medium: 0, high: 0, notAudited: 0 } },
        demandByType: { A: 1 },
        nullDemandCount: -1,
      }),
    (err) => err instanceof TypeError && err.message.includes('nullDemandCount')
  )
);

// Case p: Determinism
const secondRun = evaluateTypeDecisions(mainInput);
check(() => assert.deepEqual(mainResult, secondRun));

console.log(`testTypeDecisionRules: PASS (${assertions} assertions)`);
