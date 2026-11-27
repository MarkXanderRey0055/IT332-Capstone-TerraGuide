import assert from 'node:assert/strict';
import { computeRiskLevel } from './src/utils/auditReadiness.js';
import {
  UNANSWERED_INQUIRY_DAYS,
  ELAPSED_INQUIRY_HOURS,
  HIGH_RISK_LEVEL,
  HIGH_RISK_EVIDENCE_KEYS,
  STALE_INQUIRY_EVIDENCE_KEYS,
  SITE_VISIT_EVIDENCE_KEYS,
  extractId,
  formatManilaDate,
  buildAsiaManilaDayStart,
  evaluateHighRiskDocuments,
  evaluateStaleInquiries,
  evaluateOverdueSiteVisits,
  buildPortfolioActions,
} from './src/utils/portfolioRules.js';

let assertionCount = 0;
function check(fn) {
  fn();
  assertionCount += 1;
}

function assertEvidenceKeys(evidenceList, expectedKeys) {
  for (const item of evidenceList) {
    check(() => assert.deepEqual(Object.keys(item), expectedKeys));
  }
}

const REF_DATE = new Date('2026-11-26T12:00:00Z');

// Constants
check(() => assert.equal(UNANSWERED_INQUIRY_DAYS, 7));
check(() => assert.equal(ELAPSED_INQUIRY_HOURS, 168));
check(() => assert.equal(HIGH_RISK_LEVEL, 'High'));
check(() =>
  assert.deepEqual(STALE_INQUIRY_EVIDENCE_KEYS, [
    'inquiryId',
    'propertyId',
    'propertyName',
    'createdAtManila',
    'ageHours',
  ])
);

// Case a: extractId handles ObjectId-like toHexString and plain strings
const oidLike = {
  toHexString: () => '64b000000000000000000001',
  id: Buffer.from('0123456789ab'),
};
const extractedOid = extractId(oidLike);
check(() => assert.equal(extractedOid, '64b000000000000000000001'));
check(() => assert.match(extractedOid, /^[0-9a-f]{24}$/));
check(() => assert.equal(extractId('64b000000000000000000002'), '64b000000000000000000002'));

// buildAsiaManilaDayStart
const dayStart = buildAsiaManilaDayStart(REF_DATE);
check(() => assert.equal(dayStart.toISOString(), '2026-11-25T16:00:00.000Z'));

// ---- HIGH_RISK_DOCUMENTS ----
// a. One Available High-risk (30) and one Available Low-risk (80)
const hrA = evaluateHighRiskDocuments({
  listings: [
    { _id: 'p1', name: 'Hillside Lot', type: 'Residential', status: 'Available', owner: 'Secret Owner' },
    { _id: 'p2', name: 'Valley Lot', type: 'Residential', status: 'Available', owner: 'Another Owner' },
  ],
  latestAuditByPropertyId: new Map([
    ['p1', { documentCompleteness: 30, complianceScore: 30 }],
    ['p2', { documentCompleteness: 80, complianceScore: 80 }],
  ]),
});
check(() => assert.equal(hrA.ruleId, 'HIGH_RISK_DOCUMENTS'));
check(() => assert.equal(hrA.fired, true));
check(() => assert.equal(hrA.matchCount, 1));
check(() => assert.equal(hrA.sampleSize, 2));
check(() => assert.equal(hrA.action, 'Review document readiness for 1 high-risk listing (Hillside Lot, ID p1).'));
assertEvidenceKeys(hrA.evidence, HIGH_RISK_EVIDENCE_KEYS);

// b. Two High-risk listings (Reserved + Available), sorted by complianceScore ascending
const hrB = evaluateHighRiskDocuments({
  listings: [
    { _id: 'p2', name: 'Second Lot', type: 'Commercial', status: 'Reserved', owner: 'Owner Two' },
    { _id: 'p1', name: 'First Lot', type: 'Agricultural', status: 'Available', owner: 'Owner One' },
  ],
  latestAuditByPropertyId: new Map([
    ['p2', { documentCompleteness: 35, complianceScore: 35 }],
    ['p1', { documentCompleteness: 15, complianceScore: 15 }],
  ]),
});
check(() => assert.equal(hrB.fired, true));
check(() => assert.equal(hrB.matchCount, 2));
check(() => assert.deepEqual(hrB.evidence.map((e) => e.propertyId), ['p1', 'p2']));
check(() => assert.equal(hrB.action, 'Review document readiness for 2 high-risk listings, starting with First Lot (ID p1).'));
assertEvidenceKeys(hrB.evidence, HIGH_RISK_EVIDENCE_KEYS);

// c. One Sold listing with High-risk audit -> excluded
const hrC = evaluateHighRiskDocuments({
  listings: [{ _id: 'p-sold', name: 'Sold Lot', type: 'Residential', status: 'Sold' }],
  latestAuditByPropertyId: new Map([['p-sold', { documentCompleteness: 10, complianceScore: 10 }]]),
});
check(() => assert.equal(hrC.fired, false));
check(() => assert.equal(hrC.matchCount, 0));

// d. Empty listings array
const hrD = evaluateHighRiskDocuments({ listings: [], latestAuditByPropertyId: new Map() });
check(() => assert.equal(hrD.fired, false));
check(() => assert.equal(hrD.sampleSize, 0));
check(() => assert.match(hrD.action, /No audited listings yet/));

// ---- New test (b): Empty ID listing excluded from sampleSize and matches ----
const hrEmptyId = evaluateHighRiskDocuments({
  listings: [
    { _id: '', name: 'No ID Lot', type: 'Residential', status: 'Available' },
    { _id: 'p-valid', name: 'Valid Lot', type: 'Residential', status: 'Available' },
  ],
  latestAuditByPropertyId: new Map([
    ['', { documentCompleteness: 10, complianceScore: 10 }],
    ['p-valid', { documentCompleteness: 20, complianceScore: 20 }],
  ]),
});
check(() => assert.equal(hrEmptyId.sampleSize, 1));
check(() => assert.equal(hrEmptyId.matchCount, 1));
check(() => assert.deepEqual(hrEmptyId.evidence.map((e) => e.propertyId), ['p-valid']));
assertEvidenceKeys(hrEmptyId.evidence, HIGH_RISK_EVIDENCE_KEYS);

// ---- New test (d): Risk parity with computeRiskLevel (documentCompleteness only) ----
const parityScores = [0, 39, 40, 69, 70];
const parityReport = [];
for (const score of parityScores) {
  const audit = { documentCompleteness: score };
  const expectedRisk = computeRiskLevel(audit);
  parityReport.push(`${score}=${expectedRisk}`);
  const evalResult = evaluateHighRiskDocuments({
    listings: [{ _id: `p-${score}`, name: `Lot ${score}`, type: 'Residential', status: 'Available' }],
    latestAuditByPropertyId: new Map([[`p-${score}`, audit]]),
  });
  check(() => assert.equal(evalResult.fired, expectedRisk === 'High'));
  if (evalResult.fired) {
    check(() => assert.equal(evalResult.evidence[0].riskLevel, expectedRisk));
    assertEvidenceKeys(evalResult.evidence, HIGH_RISK_EVIDENCE_KEYS);
  }
}

// ---- STALE_PENDING_INQUIRIES ----
const names = new Map([['p1', 'Hillside Lot']]);

// a. One Pending inquiry 8 days old
const inqA = evaluateStaleInquiries({
  inquiries: [
    {
      _id: 'inq-1',
      status: 'Pending',
      createdAt: '2026-11-18T12:00:00Z',
      propertyId: 'p1',
      buyerId: 'buyer-secret',
      message: 'Private buyer@example.com message',
    },
  ],
  propertyNameById: names,
  referenceDate: REF_DATE,
});
check(() => assert.equal(inqA.ruleId, 'STALE_PENDING_INQUIRIES'));
check(() => assert.equal(inqA.fired, true));
check(() => assert.equal(inqA.matchCount, 1));
check(() => assert.match(inqA.action, /more than 7 days/));
check(() => assert.equal(inqA.evidence[0].ageHours, 192));
check(() => assert.equal(inqA.evidence[0].createdAtManila, '2026-11-18 20:00'));
assertEvidenceKeys(inqA.evidence, STALE_INQUIRY_EVIDENCE_KEYS);

// Case b: Elapsed boundary, stale inquiry (exactly 168h does not fire; 168h + 1ms fires)
const inqExact168h = evaluateStaleInquiries({
  inquiries: [{ _id: 'inq-168', status: 'Pending', createdAt: '2026-11-19T12:00:00.000Z', propertyId: 'p1' }],
  propertyNameById: names,
  referenceDate: REF_DATE,
});
check(() => assert.equal(inqExact168h.fired, false));

const inq168hPlus1ms = evaluateStaleInquiries({
  inquiries: [{ _id: 'inq-168-plus', status: 'Pending', createdAt: '2026-11-19T11:59:59.999Z', propertyId: 'p1' }],
  propertyNameById: names,
  referenceDate: REF_DATE,
});
check(() => assert.equal(inq168hPlus1ms.fired, true));
check(() => assert.equal(inq168hPlus1ms.evidence[0].ageHours, 168));
assertEvidenceKeys(inq168hPlus1ms.evidence, STALE_INQUIRY_EVIDENCE_KEYS);

// Case c: Manila date formatting on inquiry (2026-11-19T17:00:00Z -> "2026-11-20 01:00")
const inqManila = evaluateStaleInquiries({
  inquiries: [{ _id: 'inq-manila', status: 'Pending', createdAt: '2026-11-19T17:00:00Z', propertyId: 'p1' }],
  propertyNameById: names,
  referenceDate: new Date('2026-11-27T10:00:00+08:00'),
});
check(() => assert.equal(inqManila.fired, true));
check(() => assert.equal(inqManila.evidence[0].createdAtManila, '2026-11-20 01:00'));
assertEvidenceKeys(inqManila.evidence, STALE_INQUIRY_EVIDENCE_KEYS);

// b. Two Pending inquiries created 2026-11-24 -> not stale
const inqB = evaluateStaleInquiries({
  inquiries: [
    { _id: 'inq-2', status: 'Pending', createdAt: '2026-11-24T12:00:00Z', propertyId: 'p1' },
    { _id: 'inq-3', status: 'Pending', createdAt: '2026-11-24T15:00:00Z', propertyId: 'p1' },
  ],
  propertyNameById: names,
  referenceDate: REF_DATE,
});
check(() => assert.equal(inqB.fired, false));
check(() => assert.equal(inqB.sampleSize, 2));

// c. Responded inquiry from 2026-10-01 -> ignored
const inqC = evaluateStaleInquiries({
  inquiries: [{ _id: 'inq-4', status: 'Responded', createdAt: '2026-10-01T00:00:00Z', propertyId: 'p1' }],
  propertyNameById: names,
  referenceDate: REF_DATE,
});
check(() => assert.equal(inqC.fired, false));
check(() => assert.equal(inqC.sampleSize, 0));

// d. Missing propertyId in propertyNameById -> "Unavailable listing"
const inqD = evaluateStaleInquiries({
  inquiries: [{ _id: 'inq-5', status: 'Pending', createdAt: '2026-11-10T00:00:00Z', propertyId: 'missing-id' }],
  propertyNameById: names,
  referenceDate: REF_DATE,
});
check(() => assert.equal(inqD.fired, true));
check(() => assert.equal(inqD.evidence[0].propertyName, 'Unavailable listing'));
check(() => assert.equal(inqD.evidence[0].propertyId, 'missing-id'));
assertEvidenceKeys(inqD.evidence, STALE_INQUIRY_EVIDENCE_KEYS);

// ---- OVERDUE_PENDING_SITE_VISITS ----
// a. Pending visit 2026-11-20 -> fires
const svA = evaluateOverdueSiteVisits({
  siteVisits: [
    {
      _id: 'sv-1',
      status: 'Pending',
      preferredDate: '2026-11-20T00:00:00Z',
      propertyId: 'p1',
      buyerId: 'buyer-secret',
      notes: 'Contact buyer@example.com',
    },
  ],
  propertyNameById: names,
  referenceDate: REF_DATE,
});
check(() => assert.equal(svA.ruleId, 'OVERDUE_PENDING_SITE_VISITS'));
check(() => assert.equal(svA.fired, true));
check(() => assert.equal(svA.matchCount, 1));
assertEvidenceKeys(svA.evidence, SITE_VISIT_EVIDENCE_KEYS);

// b. Pending visits 2026-11-26 and 2026-12-01 -> does not fire
const svB = evaluateOverdueSiteVisits({
  siteVisits: [
    { _id: 'sv-2', status: 'Pending', preferredDate: '2026-11-26T00:00:00Z', propertyId: 'p1' },
    { _id: 'sv-3', status: 'Pending', preferredDate: '2026-12-01T00:00:00Z', propertyId: 'p1' },
  ],
  propertyNameById: names,
  referenceDate: REF_DATE,
});
check(() => assert.equal(svB.fired, false));
check(() => assert.equal(svB.sampleSize, 2));

// c. Scheduled visit 2026-11-10 -> does not fire
const svC = evaluateOverdueSiteVisits({
  siteVisits: [{ _id: 'sv-4', status: 'Scheduled', preferredDate: '2026-11-10T00:00:00Z', propertyId: 'p1' }],
  propertyNameById: names,
  referenceDate: REF_DATE,
});
check(() => assert.equal(svC.fired, false));

// d. Boundary check: reference date 2026-11-26T00:30:00+08:00 (2026-11-25T16:30:00Z)
const boundaryRef = new Date('2026-11-26T00:30:00+08:00');
check(() => assert.equal(buildAsiaManilaDayStart(boundaryRef).toISOString(), '2026-11-25T16:00:00.000Z'));

const svBeforeBoundary = evaluateOverdueSiteVisits({
  siteVisits: [{ _id: 'sv-before', status: 'Pending', preferredDate: '2026-11-25T15:59:59Z', propertyId: 'p1' }],
  propertyNameById: names,
  referenceDate: boundaryRef,
});
check(() => assert.equal(svBeforeBoundary.fired, true, '2026-11-25T15:59:59Z must fire before Manila day start'));
assertEvidenceKeys(svBeforeBoundary.evidence, SITE_VISIT_EVIDENCE_KEYS);

const svAtBoundary = evaluateOverdueSiteVisits({
  siteVisits: [{ _id: 'sv-at', status: 'Pending', preferredDate: '2026-11-25T16:00:00Z', propertyId: 'p1' }],
  propertyNameById: names,
  referenceDate: boundaryRef,
});
check(() => assert.equal(svAtBoundary.fired, false, '2026-11-25T16:00:00Z must not fire at Manila day start'));

// Case e: Visit boundary at exact Manila day start vs 1 ms earlier
const sv1msBeforeBoundary = evaluateOverdueSiteVisits({
  siteVisits: [{ _id: 'sv-1ms-before', status: 'Pending', preferredDate: '2026-11-25T15:59:59.999Z', propertyId: 'p1' }],
  propertyNameById: names,
  referenceDate: boundaryRef,
});
check(() => assert.equal(sv1msBeforeBoundary.fired, true));
check(() => assert.equal(sv1msBeforeBoundary.evidence[0].preferredDate, '2026-11-25'));

// Case d: Manila date, visit (2026-11-25T16:00:00Z -> "2026-11-26"; overdue on 2026-11-27T10:00:00+08:00)
check(() => assert.equal(formatManilaDate(new Date('2026-11-25T16:00:00Z')), '2026-11-26'));
const svManilaNov27 = evaluateOverdueSiteVisits({
  siteVisits: [{ _id: 'sv-manila', status: 'Pending', preferredDate: '2026-11-25T16:00:00Z', propertyId: 'p1' }],
  propertyNameById: names,
  referenceDate: new Date('2026-11-27T10:00:00+08:00'),
});
check(() => assert.equal(svManilaNov27.fired, true));
check(() => assert.equal(svManilaNov27.evidence[0].preferredDate, '2026-11-26'));
assertEvidenceKeys(svManilaNov27.evidence, SITE_VISIT_EVIDENCE_KEYS);

// ---- buildPortfolioActions ----
const allFired = buildPortfolioActions({
  listings: [{ _id: 'p1', name: 'Hillside Lot', type: 'Residential', status: 'Available' }],
  latestAuditByPropertyId: new Map([['p1', { documentCompleteness: 25, complianceScore: 25 }]]),
  inquiries: [{ _id: 'inq-1', status: 'Pending', createdAt: '2026-11-18T12:00:00Z', propertyId: 'p1' }],
  siteVisits: [{ _id: 'sv-1', status: 'Pending', preferredDate: '2026-11-20T00:00:00Z', propertyId: 'p1' }],
  propertyNameById: names,
  referenceDate: REF_DATE,
});
check(() => assert.equal(allFired.referenceDate, '2026-11-26'));
check(() => assert.equal(allFired.computedAt, REF_DATE.toISOString()));
check(() => assert.equal(allFired.actions.length, 3));
check(() =>
  assert.deepEqual(
    allFired.actions.map((a) => a.ruleId),
    ['HIGH_RISK_DOCUMENTS', 'STALE_PENDING_INQUIRIES', 'OVERDUE_PENDING_SITE_VISITS']
  )
);
assertEvidenceKeys(allFired.actions[0].evidence, HIGH_RISK_EVIDENCE_KEYS);
assertEvidenceKeys(allFired.actions[1].evidence, STALE_INQUIRY_EVIDENCE_KEYS);
assertEvidenceKeys(allFired.actions[2].evidence, SITE_VISIT_EVIDENCE_KEYS);

const noneFired = buildPortfolioActions({
  listings: [{ _id: 'p1', name: 'Hillside Lot', type: 'Residential', status: 'Available' }],
  latestAuditByPropertyId: new Map([['p1', { documentCompleteness: 90, complianceScore: 90 }]]),
  inquiries: [],
  siteVisits: [],
  propertyNameById: names,
  referenceDate: REF_DATE,
});
check(() => assert.equal(noneFired.actions.length, 0));
check(() => assert.equal(noneFired.computedAt, REF_DATE.toISOString()));
check(() => assert.equal(noneFired.rulesEvaluated.length, 3));
check(() => assert.equal(noneFired.rulesEvaluated.every((r) => r.fired === false), true));

// ---- New test (c): Invalid referenceDate throws TypeError ----
const invalidDates = [undefined, null, 'not-a-date', new Date(NaN)];
const expectedRefError = (err) =>
  err instanceof TypeError && err.message === 'referenceDate must be a valid date';

for (const badDate of invalidDates) {
  check(() => assert.throws(() => buildAsiaManilaDayStart(badDate), expectedRefError));
  check(() =>
    assert.throws(
      () => evaluateStaleInquiries({ inquiries: [], propertyNameById: names, referenceDate: badDate }),
      expectedRefError
    )
  );
  check(() =>
    assert.throws(
      () => evaluateOverdueSiteVisits({ siteVisits: [], propertyNameById: names, referenceDate: badDate }),
      expectedRefError
    )
  );
  check(() =>
    assert.throws(
      () => buildPortfolioActions({ referenceDate: badDate }),
      expectedRefError
    )
  );
}

console.log(`Portfolio rules tests passed (${assertionCount} assertions).`);
console.log(`Risk parity: ${parityReport.join(', ')}`);
console.log(`Boundary 3d: 2026-11-25T15:59:59Z fired=${svBeforeBoundary.fired}; 2026-11-25T16:00:00Z fired=${svAtBoundary.fired}.`);
