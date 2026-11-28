import assert from 'node:assert/strict';
import User from './src/models/User.js';
import BuyerPreference from './src/models/BuyerPreference.js';
import Property from './src/models/Property.js';
import Audit from './src/models/Audit.js';
import Inquiry from './src/models/Inquiry.js';
import SiteVisit from './src/models/SiteVisit.js';
import { getTypeDecisionSnapshot } from './src/services/analyticsService.js';
import { getTypeDecisions } from './src/controllers/AnalyticsController.js';
import analyticsRouter from './src/routes/analyticsRoutes.js';
import { protect } from './src/middleware/authMiddleware.js';
import {
  HIGH_RISK_EVIDENCE_KEYS,
  STALE_INQUIRY_EVIDENCE_KEYS,
  SITE_VISIT_EVIDENCE_KEYS,
} from './src/utils/portfolioRules.js';

let assertions = 0;
function check(fn) {
  fn();
  assertions += 1;
}

const originalUserFind = User.find;
const originalPrefFind = BuyerPreference.find;
const originalPropertyFind = Property.find;
const originalAuditAggregate = Audit.aggregate;
const originalInquiryFind = Inquiry.find;
const originalSiteVisitFind = SiteVisit.find;

function applyProjection(doc, projection) {
  if (!projection) return { ...doc };
  const out = {};
  for (const [key, include] of Object.entries(projection)) {
    if (include && key in doc) {
      out[key] = doc[key];
    }
  }
  return out;
}

function makeStubs(fixture) {
  const seenProjections = {};

  User.find = async (filter = {}, projection = null) => {
    seenProjections.user = projection;
    return fixture.users
      .filter((u) => !filter.role || u.role === filter.role)
      .map((u) => applyProjection(u, projection));
  };

  BuyerPreference.find = async (filter = {}, projection = null) => {
    seenProjections.pref = projection;
    const allowedIds = filter.userId?.$in ? new Set(filter.userId.$in.map(String)) : null;
    return fixture.preferences
      .filter((p) => !allowedIds || allowedIds.has(String(p.userId)))
      .map((p) => applyProjection(p, projection));
  };

  Property.find = async (filter = {}, projection = null) => {
    seenProjections.property = projection;
    return fixture.properties
      .filter((p) => !filter.status || p.status === filter.status)
      .map((p) => applyProjection(p, projection));
  };

  Audit.aggregate = async () => {
    const sorted = [...fixture.audits].sort(
      (a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
    );
    const seen = new Set();
    const latest = [];
    for (const audit of sorted) {
      const pid = String(audit.propertyId);
      if (seen.has(pid)) continue;
      seen.add(pid);
      latest.push({ _id: audit.propertyId, audit });
    }
    return latest;
  };

  Inquiry.find = async (filter = {}, projection = null) => {
    seenProjections.inquiry = projection;
    return fixture.inquiries
      .filter((i) => !filter.status || i.status === filter.status)
      .map((i) => applyProjection(i, projection));
  };

  SiteVisit.find = async (filter = {}, projection = null) => {
    seenProjections.siteVisit = projection;
    return fixture.siteVisits
      .filter((v) => !filter.status || v.status === filter.status)
      .map((v) => applyProjection(v, projection));
  };

  return seenProjections;
}

function buildMainFixture() {
  const users = [];
  const preferences = [];
  let buyerNum = 1;

  const addBuyers = (count, landType) => {
    for (let i = 0; i < count; i += 1) {
      const id = `BUYER-SECRET-ID-${buyerNum}`;
      users.push({
        _id: id,
        role: 'buyer',
        email: `buyer${buyerNum}.private@example.com`,
        name: `Buyer Private ${buyerNum}`,
      });
      preferences.push({ userId: id, landType });
      buyerNum += 1;
    }
  };

  addBuyers(7, 'Residential');
  addBuyers(4, 'Agricultural');
  addBuyers(2, 'Commercial');
  addBuyers(2, 'House & Lot');
  addBuyers(1, null);

  // Admin user + admin preference (must be excluded)
  users.push({
    _id: 'ADMIN-SECRET-ID-1',
    role: 'admin',
    email: 'admin.private@example.com',
    name: 'Admin Private',
  });
  preferences.push({ userId: 'ADMIN-SECRET-ID-1', landType: 'Commercial' });

  // Orphan preference (userId not in users, must be excluded)
  preferences.push({ userId: 'ORPHAN-SECRET-ID-1', landType: 'Residential' });

  const properties = [];
  const audits = [];
  let propNum = 1;

  const addProperties = (type, specs) => {
    for (const spec of specs) {
      const id = `prop-${propNum}`;
      properties.push({
        _id: id,
        name: `${type} Lot ${propNum}`,
        type,
        price: spec.price ?? 2_000_000,
        status: spec.status ?? 'Available',
        owner: `Secret Owner ${propNum}`,
      });
      if (spec.score !== null && spec.score !== undefined) {
        audits.push({
          propertyId: id,
          documentCompleteness: spec.score,
          complianceScore: spec.score,
          generatedAt: new Date('2026-11-20T00:00:00Z'),
        });
      }
      propNum += 1;
    }
  };

  // Residential: 4 (3 Low, 1 Medium)
  addProperties('Residential', [{ score: 100 }, { score: 85 }, { score: 70 }, { score: 50 }]);
  // Agricultural: 3 (2 Low, 1 Medium)
  addProperties('Agricultural', [{ score: 90 }, { score: 75 }, { score: 45 }]);
  // Commercial: 3 (3 Low)
  addProperties('Commercial', [{ score: 100 }, { score: 80 }, { score: 70 }]);
  // House & Lot: 8 (3 Low, 5 notAudited)
  addProperties('House & Lot', [
    { score: 90 },
    { score: 80 },
    { score: 70 },
    { score: null },
    { score: null },
    { score: null },
    { score: null },
    { score: null },
  ]);
  // Excluded Sold listing
  addProperties('Residential', [{ score: 20, status: 'Sold' }]);

  const inquiries = [
    {
      _id: 'inq-stale-1',
      propertyId: 'prop-1',
      buyerId: 'BUYER-SECRET-ID-1',
      message: 'Private buyer message',
      status: 'Pending',
      createdAt: new Date('2026-11-10T00:00:00Z'),
    },
  ];

  const siteVisits = [
    {
      _id: 'sv-overdue-1',
      propertyId: 'prop-2',
      buyerId: 'BUYER-SECRET-ID-2',
      notes: 'Private site visit note',
      status: 'Pending',
      preferredDate: new Date('2026-11-20T00:00:00Z'),
    },
  ];

  return { users, preferences, properties, audits, inquiries, siteVisits };
}

function decisionByType(snapshot, type) {
  return snapshot.typeDecisions.decisions.find((d) => d.type === type);
}

const REFERENCE_DATE = new Date('2026-11-27T04:00:00Z');

try {
  // --- Main fixture (cases a through g) ---
  const mainFixture = buildMainFixture();
  const seenProjections = makeStubs(mainFixture);
  const snapshot = await getTypeDecisionSnapshot(REFERENCE_DATE);

  // Verify personal fields were never requested in projections
  check(() => assert.equal('owner' in seenProjections.property, false));
  check(() => assert.equal('buyerId' in seenProjections.inquiry, false));
  check(() => assert.equal('message' in seenProjections.inquiry, false));
  check(() => assert.equal('buyerId' in seenProjections.siteVisit, false));
  check(() => assert.equal('notes' in seenProjections.siteVisit, false));

  // Case a: exact top-level keys
  check(() =>
    assert.deepEqual(Object.keys(snapshot).sort(), [
      'operationalActions',
      'referenceDate',
      'typeDecisions',
    ])
  );

  // Also test controller handler wrapper
  let controllerStatus = null;
  let controllerBody = null;
  const mockRes = {
    status(code) {
      controllerStatus = code;
      return this;
    },
    json(payload) {
      controllerBody = payload;
      return this;
    },
  };
  await new Promise((resolve, reject) => {
    getTypeDecisions({}, mockRes, (err) => (err ? reject(err) : resolve()));
    setImmediate(resolve);
  });
  check(() => assert.equal(controllerStatus, 200));
  check(() =>
    assert.deepEqual(Object.keys(controllerBody.data).sort(), [
      'operationalActions',
      'referenceDate',
      'typeDecisions',
    ])
  );

  // Case b: type decisions match dataset counts
  const res = decisionByType(snapshot, 'Residential');
  const agri = decisionByType(snapshot, 'Agricultural');
  const comm = decisionByType(snapshot, 'Commercial');
  const hl = decisionByType(snapshot, 'House & Lot');

  check(() => assert.equal(res.decision, 'shortage'));
  check(() => assert.equal(res.blockingCount, 0));
  check(() => assert.equal(agri.decision, 'insufficient_sample'));
  check(() => assert.equal(comm.decision, 'insufficient_sample'));
  check(() => assert.equal(hl.decision, 'insufficient_sample'));

  // Case c: Residential sentence is the shortage-ready template
  check(() =>
    assert.equal(
      res.sentence,
      'Residential: 7 buyers prefer this type (46.7% of stated preferences) against 4 Available listings (22.2% of supply). Source or promote.'
    )
  );

  // Case d: operationalActions rules fired / not fired + computedAt
  const rulesById = Object.fromEntries(
    snapshot.operationalActions.rulesEvaluated.map((r) => [r.ruleId, r])
  );
  check(() => assert.equal(snapshot.operationalActions.computedAt, REFERENCE_DATE.toISOString()));
  check(() => assert.equal(rulesById.OVERDUE_PENDING_SITE_VISITS.fired, true));
  check(() => assert.equal(rulesById.STALE_PENDING_INQUIRIES.fired, true));
  check(() => assert.equal(rulesById.HIGH_RISK_DOCUMENTS.fired, false));
  check(() =>
    assert.equal(rulesById.STALE_PENDING_INQUIRIES.evidence[0].propertyName, 'Residential Lot 1')
  );
  check(() =>
    assert.equal(rulesById.OVERDUE_PENDING_SITE_VISITS.evidence[0].propertyName, 'Residential Lot 2')
  );

  // Case e: exact allow-listed keys on every evidence item
  const expectedKeysByRule = {
    HIGH_RISK_DOCUMENTS: [...HIGH_RISK_EVIDENCE_KEYS].sort(),
    STALE_PENDING_INQUIRIES: [...STALE_INQUIRY_EVIDENCE_KEYS].sort(),
    OVERDUE_PENDING_SITE_VISITS: [...SITE_VISIT_EVIDENCE_KEYS].sort(),
  };
  for (const rule of snapshot.operationalActions.rulesEvaluated) {
    for (const item of rule.evidence) {
      check(() => assert.deepEqual(Object.keys(item).sort(), expectedKeysByRule[rule.ruleId]));
    }
  }

  // Case f: serialized response does not contain known fixture buyer IDs, owners, or emails
  const serialized = JSON.stringify(snapshot);
  const forbiddenStrings = [
    'BUYER-SECRET-ID-1',
    'BUYER-SECRET-ID-2',
    'ADMIN-SECRET-ID-1',
    'ORPHAN-SECRET-ID-1',
    'Secret Owner 1',
    'Secret Owner 2',
    'buyer1.private@example.com',
    'admin.private@example.com',
    'Private buyer message',
    'Private site visit note',
  ];
  for (const secret of forbiddenStrings) {
    check(() => assert.equal(serialized.includes(secret), false, `Response leaked ${secret}`));
  }

  // Case g: excluded records (orphan, admin, Sold) do not affect counts
  check(() => assert.equal(snapshot.typeDecisions.demandTotal, 15));
  check(() => assert.equal(snapshot.typeDecisions.supplyTotal, 18));
  check(() => assert.equal(snapshot.typeDecisions.nullDemandCount, 1));
  check(() => assert.equal(res.buyers, 7));
  check(() => assert.equal(res.listings, 4));
  check(() => assert.equal(comm.buyers, 2));

  // --- Case h: exact +15.0 boundary with 5 buyers through endpoint path ---
  // T = 20 (X: 5, Y: 15), U = 20 (X: 2, Y: 18) -> diff100 = 100*(5*20 - 2*20) = 6000 === 15*20*20
  const boundaryPlusFixture = {
    users: Array.from({ length: 20 }, (_, i) => ({ _id: `b-${i}`, role: 'buyer' })),
    preferences: [
      ...Array.from({ length: 5 }, (_, i) => ({ userId: `b-${i}`, landType: 'Residential' })),
      ...Array.from({ length: 15 }, (_, i) => ({ userId: `b-${i + 5}`, landType: 'Commercial' })),
    ],
    properties: [
      ...Array.from({ length: 2 }, (_, i) => ({
        _id: `px-${i}`,
        name: `Res ${i}`,
        type: 'Residential',
        price: 1_000_000,
        status: 'Available',
      })),
      ...Array.from({ length: 18 }, (_, i) => ({
        _id: `py-${i}`,
        name: `Com ${i}`,
        type: 'Commercial',
        price: 1_000_000,
        status: 'Available',
      })),
    ],
    audits: [
      ...Array.from({ length: 2 }, (_, i) => ({
        propertyId: `px-${i}`,
        documentCompleteness: 100,
        complianceScore: 100,
        generatedAt: new Date('2026-11-20T00:00:00Z'),
      })),
      ...Array.from({ length: 18 }, (_, i) => ({
        propertyId: `py-${i}`,
        documentCompleteness: 100,
        complianceScore: 100,
        generatedAt: new Date('2026-11-20T00:00:00Z'),
      })),
    ],
    inquiries: [],
    siteVisits: [],
  };
  makeStubs(boundaryPlusFixture);
  const boundaryPlusSnap = await getTypeDecisionSnapshot(REFERENCE_DATE);
  const boundaryPlusRes = decisionByType(boundaryPlusSnap, 'Residential');
  check(() => assert.equal(boundaryPlusRes.decision, 'shortage'));
  check(() => assert.equal(boundaryPlusRes.gapPointsDisplay, 15.0));

  // --- Case i: minimum sample (4 buyers, large gap) through endpoint path ---
  const minSampleFixture = {
    users: Array.from({ length: 5 }, (_, i) => ({ _id: `ms-${i}`, role: 'buyer' })),
    preferences: [
      ...Array.from({ length: 4 }, (_, i) => ({ userId: `ms-${i}`, landType: 'Residential' })),
      { userId: 'ms-4', landType: 'Commercial' },
    ],
    properties: [
      { _id: 'mp-1', name: 'Res 1', type: 'Residential', price: 1_000_000, status: 'Available' },
      ...Array.from({ length: 4 }, (_, i) => ({
        _id: `mp-${i + 2}`,
        name: `Com ${i}`,
        type: 'Commercial',
        price: 1_000_000,
        status: 'Available',
      })),
    ],
    audits: [],
    inquiries: [],
    siteVisits: [],
  };
  makeStubs(minSampleFixture);
  const minSampleSnap = await getTypeDecisionSnapshot(REFERENCE_DATE);
  check(() => assert.equal(decisionByType(minSampleSnap, 'Residential').decision, 'insufficient_sample'));

  // --- Case j: singular/plural wording for 1 vs 2 blocking listings ---
  const oneBlockerFixture = buildMainFixture();
  // Remove audit for prop-1 (Residential) -> 1 blocking listing
  oneBlockerFixture.audits = oneBlockerFixture.audits.filter((a) => a.propertyId !== 'prop-1');
  makeStubs(oneBlockerFixture);
  const oneBlockerSnap = await getTypeDecisionSnapshot(REFERENCE_DATE);
  check(() =>
    assert.ok(
      decisionByType(oneBlockerSnap, 'Residential').sentence.includes('1 existing listing first')
    )
  );

  const twoBlockersFixture = buildMainFixture();
  // Remove audits for prop-1 and prop-2 (Residential) -> 2 blocking listings
  twoBlockersFixture.audits = twoBlockersFixture.audits.filter(
    (a) => a.propertyId !== 'prop-1' && a.propertyId !== 'prop-2'
  );
  makeStubs(twoBlockersFixture);
  const twoBlockersSnap = await getTypeDecisionSnapshot(REFERENCE_DATE);
  check(() =>
    assert.ok(
      decisionByType(twoBlockersSnap, 'Residential').sentence.includes('2 existing listings first')
    )
  );

  // --- Case k: surplus-boundary sample check (-15.0 gap, 4 buyers -> insufficient_sample) ---
  // T = 20 (Res: 4, Com: 16), U = 20 (Res: 7, Com: 13) -> diff100 = 100*(4*20 - 7*20) = -6000 === -15*20*20
  const surplusBoundaryLowSampleFixture = {
    users: Array.from({ length: 20 }, (_, i) => ({ _id: `sb-${i}`, role: 'buyer' })),
    preferences: [
      ...Array.from({ length: 4 }, (_, i) => ({ userId: `sb-${i}`, landType: 'Residential' })),
      ...Array.from({ length: 16 }, (_, i) => ({ userId: `sb-${i + 4}`, landType: 'Commercial' })),
    ],
    properties: [
      ...Array.from({ length: 7 }, (_, i) => ({
        _id: `sbp-r-${i}`,
        name: `Res ${i}`,
        type: 'Residential',
        price: 1_000_000,
        status: 'Available',
      })),
      ...Array.from({ length: 13 }, (_, i) => ({
        _id: `sbp-c-${i}`,
        name: `Com ${i}`,
        type: 'Commercial',
        price: 1_000_000,
        status: 'Available',
      })),
    ],
    audits: [],
    inquiries: [],
    siteVisits: [],
  };
  makeStubs(surplusBoundaryLowSampleFixture);
  const surplusBoundarySnap = await getTypeDecisionSnapshot(REFERENCE_DATE);
  const surplusBoundaryRes = decisionByType(surplusBoundarySnap, 'Residential');
  check(() => assert.equal(surplusBoundaryRes.decision, 'insufficient_sample'));
  check(() => assert.equal(surplusBoundaryRes.gapPointsDisplay, -15.0));

  // --- Case l: auth middleware on GET /type-decisions matches other admin analytics routes ---
  const findRouteLayer = (path, method) =>
    analyticsRouter.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]);

  const typeDecisionsLayer = findRouteLayer('/type-decisions', 'get');
  const dashboardLayer = findRouteLayer('/dashboard', 'get');

  check(() => assert.ok(typeDecisionsLayer, 'GET /type-decisions route must exist'));
  check(() => assert.equal(typeDecisionsLayer.route.stack.length, dashboardLayer.route.stack.length));
  check(() => assert.equal(typeDecisionsLayer.route.stack[0].handle, protect));
  check(() =>
    assert.equal(typeDecisionsLayer.route.stack[0].handle, dashboardLayer.route.stack[0].handle)
  );
  check(() =>
    assert.equal(
      typeDecisionsLayer.route.stack[1].handle.toString(),
      dashboardLayer.route.stack[1].handle.toString()
    )
  );
  check(() => assert.equal(typeDecisionsLayer.route.stack[2].handle, getTypeDecisions));

  console.log(`testTypeDecisionEndpoint: PASS (${assertions} assertions)`);
} finally {
  User.find = originalUserFind;
  BuyerPreference.find = originalPrefFind;
  Property.find = originalPropertyFind;
  Audit.aggregate = originalAuditAggregate;
  Inquiry.find = originalInquiryFind;
  SiteVisit.find = originalSiteVisitFind;
}
