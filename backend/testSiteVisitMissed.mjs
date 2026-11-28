import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import SiteVisit, { SITE_VISIT_STATUSES } from './src/models/SiteVisit.js';
import Notification from './src/models/Notification.js';
import * as siteVisitService from './src/services/siteVisitService.js';
import { evaluateOverdueSiteVisits } from './src/utils/portfolioRules.js';

let assertions = 0;
function check(fn) {
  fn();
  assertions += 1;
}

const originalFindById = SiteVisit.findById;
const originalNotificationCreate = Notification.create;

const visitId = new mongoose.Types.ObjectId();
const buyerId = new mongoose.Types.ObjectId();
const propertyId = new mongoose.Types.ObjectId();

let stored;
let createdNotifications = [];

function makePopulateQuery(value) {
  const promise = Promise.resolve(value);
  promise.populate = () => makePopulateQuery(value);
  return promise;
}

function resetStored(overrides = {}) {
  stored = {
    _id: visitId,
    buyerId,
    propertyId,
    status: 'Pending',
    confirmedDate: null,
    confirmedTime: '',
    adminResponse: '',
    missedReason: null,
    save: async () => {},
    populate: () => makePopulateQuery({ ...stored }),
    ...overrides,
  };
  createdNotifications = [];
}

try {
  SiteVisit.findById = () => stored;
  Notification.create = async (payload) => {
    createdNotifications.push(payload);
    return payload;
  };

  // Schema enum check
  check(() => assert.deepEqual(SITE_VISIT_STATUSES, ['Pending', 'Scheduled', 'Completed', 'Missed']));

  // Case a: Pending -> Missed with non-empty reason succeeds, trims reason, returns status Missed
  resetStored({ confirmedDate: new Date('2026-11-20T00:00:00Z'), confirmedTime: '10:00' });
  const missedResult = await siteVisitService.updateSiteVisitStatus(visitId.toString(), {
    status: 'Missed',
    missedReason: '  Buyer did not show up on site  ',
  });
  check(() => assert.equal(missedResult.status, 'Missed'));
  check(() => assert.equal(stored.status, 'Missed'));
  check(() => assert.equal(stored.missedReason, 'Buyer did not show up on site'));
  check(() => assert.equal(stored.confirmedDate, null));
  check(() => assert.equal(stored.confirmedTime, ''));

  // Case g: Buyer notification for Missed uses Step 1 choice B wording, no missedReason, no "updated to Pending"
  check(() => assert.equal(createdNotifications.length, 1));
  check(() => assert.equal(createdNotifications[0].message, 'Your site visit was not completed.'));
  check(() => assert.equal(createdNotifications[0].message.includes('Buyer did not show up'), false));
  check(() => assert.equal(createdNotifications[0].message.includes('updated to Pending'), false));

  // Case b: Pending -> Missed with no reason returns 400
  resetStored();
  await assert.rejects(
    () => siteVisitService.updateSiteVisitStatus(visitId.toString(), { status: 'Missed' }),
    (err) => err.statusCode === 400 && err.message === 'A reason is required when marking a site visit as missed.'
  );
  assertions += 1;

  // Case c: Pending -> Missed with whitespace-only reason returns 400
  resetStored();
  await assert.rejects(
    () => siteVisitService.updateSiteVisitStatus(visitId.toString(), { status: 'Missed', missedReason: '   \t\n  ' }),
    (err) => err.statusCode === 400 && err.message === 'A reason is required when marking a site visit as missed.'
  );
  assertions += 1;

  // Case d: Missed is terminal (Missed -> Pending, Scheduled, Completed, Missed all return 400)
  for (const targetStatus of ['Pending', 'Scheduled', 'Completed', 'Missed']) {
    resetStored({ status: 'Missed', missedReason: 'No show' });
    await assert.rejects(
      () =>
        siteVisitService.updateSiteVisitStatus(visitId.toString(), {
          status: targetStatus,
          confirmedDate: new Date('2027-01-01T00:00:00Z'),
          confirmedTime: '10:00',
          missedReason: 'Another reason',
        }),
      (err) => err.statusCode === 400 && err.message === 'A missed site visit cannot change status.'
    );
    assertions += 1;
  }

  // Case e: Pending -> Completed is still rejected
  resetStored({ status: 'Pending' });
  await assert.rejects(
    () => siteVisitService.updateSiteVisitStatus(visitId.toString(), { status: 'Completed' }),
    (err) => err.statusCode === 400 && /Invalid site visit status transition/.test(err.message)
  );
  assertions += 1;

  // Case f: Scheduled -> Pending and Scheduled -> Completed still work, and missedReason is not set
  const confirmedDate = new Date('2027-06-12T00:00:00.000Z');
  resetStored({ status: 'Scheduled', confirmedDate, confirmedTime: '14:30' });
  await siteVisitService.updateSiteVisitStatus(visitId.toString(), {
    status: 'Pending',
    missedReason: 'Should be ignored',
  });
  check(() => assert.equal(stored.status, 'Pending'));
  check(() => assert.equal(stored.confirmedDate, null));
  check(() => assert.equal(stored.confirmedTime, ''));
  check(() => assert.equal(stored.missedReason, null));

  resetStored({ status: 'Scheduled', confirmedDate, confirmedTime: '14:30' });
  await siteVisitService.updateSiteVisitStatus(visitId.toString(), {
    status: 'Completed',
    missedReason: 'Should be ignored',
  });
  check(() => assert.equal(stored.status, 'Completed'));
  check(() => assert.equal(stored.confirmedDate, null));
  check(() => assert.equal(stored.confirmedTime, ''));
  check(() => assert.equal(stored.missedReason, null));

  // Case h: Missed visit is excluded from OVERDUE_PENDING_SITE_VISITS
  const overdueResult = evaluateOverdueSiteVisits({
    siteVisits: [
      { _id: 'sv-pending', status: 'Pending', preferredDate: '2026-11-20T00:00:00Z', propertyId: 'p1' },
      { _id: 'sv-missed', status: 'Missed', preferredDate: '2026-11-19T00:00:00Z', propertyId: 'p1' },
    ],
    propertyNameById: new Map([['p1', 'Hillside Lot']]),
    referenceDate: new Date('2026-11-27T10:00:00+08:00'),
  });
  check(() => assert.equal(overdueResult.fired, true));
  check(() => assert.equal(overdueResult.matchCount, 1));
  check(() => assert.equal(overdueResult.sampleSize, 1));
  check(() => assert.equal(overdueResult.evidence[0].siteVisitId, 'sv-pending'));

  console.log(`testSiteVisitMissed: PASS (${assertions} assertions)`);
} finally {
  SiteVisit.findById = originalFindById;
  Notification.create = originalNotificationCreate;
}
