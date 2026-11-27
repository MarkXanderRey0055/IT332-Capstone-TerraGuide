import assert from 'node:assert/strict';
import User from './src/models/User.js';
import BuyerPreference from './src/models/BuyerPreference.js';
import Property from './src/models/Property.js';
import Audit from './src/models/Audit.js';
import Inquiry from './src/models/Inquiry.js';
import SiteVisit from './src/models/SiteVisit.js';
import {
  getTypeDecisionsOnly,
  getOperationalActionsOnly,
  getTypeDecisionSnapshot,
} from './src/services/analyticsService.js';

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

const REFERENCE_DATE = new Date('2026-11-27T04:00:00Z');

const calls = {
  user: 0,
  pref: 0,
  property: 0,
  audit: 0,
  inquiry: 0,
  siteVisit: 0,
};

function resetCalls() {
  for (const key of Object.keys(calls)) calls[key] = 0;
}

try {
  User.find = async () => {
    calls.user += 1;
    return [
      { _id: 'b-1' },
      { _id: 'b-2' },
      { _id: 'b-3' },
      { _id: 'b-4' },
      { _id: 'b-5' },
    ];
  };

  BuyerPreference.find = async () => {
    calls.pref += 1;
    return [
      { userId: 'b-1', landType: 'Residential' },
      { userId: 'b-2', landType: 'Residential' },
      { userId: 'b-3', landType: 'Residential' },
      { userId: 'b-4', landType: 'Residential' },
      { userId: 'b-5', landType: 'Residential' },
    ];
  };

  Property.find = async () => {
    calls.property += 1;
    return [
      { _id: 'p-1', name: 'Lot One', type: 'Residential', price: 1_000_000, status: 'Available' },
      { _id: 'p-2', name: 'Lot Two', type: 'Commercial', price: 2_000_000, status: 'Available' },
    ];
  };

  Audit.aggregate = async () => {
    calls.audit += 1;
    return [
      { _id: 'p-1', audit: { propertyId: 'p-1', documentCompleteness: 90, complianceScore: 90, generatedAt: new Date('2026-11-20T00:00:00Z') } },
      { _id: 'p-2', audit: { propertyId: 'p-2', documentCompleteness: 80, complianceScore: 80, generatedAt: new Date('2026-11-20T00:00:00Z') } },
    ];
  };

  Inquiry.find = async () => {
    calls.inquiry += 1;
    return [
      { _id: 'inq-1', propertyId: 'p-1', status: 'Pending', createdAt: new Date('2026-11-10T00:00:00Z') },
    ];
  };

  SiteVisit.find = async () => {
    calls.siteVisit += 1;
    return [
      { _id: 'sv-1', propertyId: 'p-2', status: 'Pending', preferredDate: new Date('2026-11-20T00:00:00Z') },
    ];
  };

  // 1. getTypeDecisionsOnly: no operationalActions key, does not call Inquiry.find or SiteVisit.find
  resetCalls();
  const typeOnly = await getTypeDecisionsOnly(REFERENCE_DATE);
  check(() => assert.deepEqual(Object.keys(typeOnly).sort(), ['referenceDate', 'typeDecisions']));
  check(() => assert.equal('operationalActions' in typeOnly, false));
  check(() => assert.equal(typeOnly.referenceDate, '2026-11-27'));
  check(() => assert.equal(calls.inquiry, 0));
  check(() => assert.equal(calls.siteVisit, 0));
  check(() => assert.equal(calls.pref, 1));

  // 2. getOperationalActionsOnly: no typeDecisions key, does not call BuyerPreference.find or User.find
  resetCalls();
  const opsOnly = await getOperationalActionsOnly(REFERENCE_DATE);
  check(() => assert.deepEqual(Object.keys(opsOnly).sort(), ['operationalActions', 'referenceDate']));
  check(() => assert.equal('typeDecisions' in opsOnly, false));
  check(() => assert.equal(opsOnly.referenceDate, '2026-11-27'));
  check(() => assert.equal(opsOnly.operationalActions.computedAt, REFERENCE_DATE.toISOString()));
  check(() => assert.equal(calls.pref, 0));
  check(() => assert.equal(calls.user, 0));
  check(() => assert.equal(calls.inquiry, 1));
  check(() => assert.equal(calls.siteVisit, 1));

  // 3. getTypeDecisionSnapshot: still returns combined shape with both keys
  resetCalls();
  const combined = await getTypeDecisionSnapshot(REFERENCE_DATE);
  check(() =>
    assert.deepEqual(Object.keys(combined).sort(), [
      'operationalActions',
      'referenceDate',
      'typeDecisions',
    ])
  );
  check(() => assert.deepEqual(combined.typeDecisions, typeOnly.typeDecisions));
  check(() => assert.deepEqual(combined.operationalActions, opsOnly.operationalActions));

  console.log(`testOperationalSplit: PASS (${assertions} assertions)`);
} finally {
  User.find = originalUserFind;
  BuyerPreference.find = originalPrefFind;
  Property.find = originalPropertyFind;
  Audit.aggregate = originalAuditAggregate;
  Inquiry.find = originalInquiryFind;
  SiteVisit.find = originalSiteVisitFind;
}
