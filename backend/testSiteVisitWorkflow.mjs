import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import SiteVisit from './src/models/SiteVisit.js';
import Property from './src/models/Property.js';
import User from './src/models/User.js';
import Notification from './src/models/Notification.js';
import * as siteVisitService from './src/services/siteVisitService.js';

const id = new mongoose.Types.ObjectId();
const propertyId = new mongoose.Types.ObjectId();
let property = { _id: propertyId, status: 'Available' };
Property.findById = async () => property;
User.find = () => ({ select: async () => [] });
Notification.create = async () => ({});

let stored = {
  _id: id,
  status: 'Pending',
  confirmedDate: null,
  confirmedTime: '',
  adminResponse: '',
  save: async () => {},
  populate: () => query({ ...stored, propertyId: { name: 'Test property' }, buyerId: { fullName: 'Buyer' } }),
};
function query(value) {
  const promise = Promise.resolve(value);
  promise.populate = () => query(value);
  return promise;
}
SiteVisit.create = async () => ({ _id: id });
SiteVisit.findById = () => stored;

const badRequest = async (operation, messagePattern) => {
  await assert.rejects(operation, (error) => error.statusCode === 400 && messagePattern.test(error.message));
};

await badRequest(
  () => siteVisitService.updateSiteVisitStatus(id.toString(), { status: 'Completed' }),
  /Invalid site visit status transition/
);
await badRequest(
  () => siteVisitService.updateSiteVisitStatus(id.toString(), { status: 'Scheduled' }),
  /confirmed date is required/i
);

const confirmedDate = new Date('2027-06-12T00:00:00.000Z');
await siteVisitService.updateSiteVisitStatus(id.toString(), {
  status: 'Scheduled', confirmedDate, confirmedTime: '14:30',
});
assert.equal(stored.status, 'Scheduled');
assert.equal(stored.confirmedDate.getTime(), confirmedDate.getTime());
assert.equal(stored.confirmedTime, '14:30');

await siteVisitService.updateSiteVisitStatus(id.toString(), { status: 'Pending' });
assert.equal(stored.status, 'Pending');
assert.equal(stored.confirmedDate, null);
assert.equal(stored.confirmedTime, '');
await badRequest(
  () => siteVisitService.updateSiteVisitStatus(id.toString(), { status: 'Scheduled', confirmedDate, confirmedTime: '25:00' }),
  /HH:MM 24-hour format/i
);
await siteVisitService.updateSiteVisitStatus(id.toString(), { status: 'Scheduled', confirmedDate, confirmedTime: '14:30' });
await siteVisitService.updateSiteVisitStatus(id.toString(), { status: 'Completed' });
assert.equal(stored.status, 'Completed');
assert.equal(stored.confirmedDate, null);
assert.equal(stored.confirmedTime, '');

property = { _id: propertyId, status: 'Sold' };
await badRequest(
  () => siteVisitService.createSiteVisit({ buyerId: id, propertyId: propertyId.toString(), preferredDate: new Date() }),
  /no longer accepting inquiries or site visit requests/
);

const scheduled = new SiteVisit({
  buyerId: id, propertyId, preferredDate: new Date(), status: 'Scheduled',
  confirmedDate, confirmedTime: '9:00',
});
await assert.rejects(scheduled.validate(), /Confirmed time must be in HH:MM 24-hour format/);

console.log('Site visit workflow tests passed: transitions, required schedule, field clearing, unavailable properties, and time validation.');
