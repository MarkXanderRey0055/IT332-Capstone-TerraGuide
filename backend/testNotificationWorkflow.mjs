import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Inquiry from './src/models/Inquiry.js';
import SiteVisit from './src/models/SiteVisit.js';
import Notification from './src/models/Notification.js';
import Property from './src/models/Property.js';
import User from './src/models/User.js';
import * as inquiryService from './src/services/inquiryService.js';
import * as siteVisitService from './src/services/siteVisitService.js';

const id = () => new mongoose.Types.ObjectId();
const buyerId = id();
const propertyId = id();
const adminIds = [id(), id()];
const property = { _id: propertyId, status: 'Available' };
Property.findById = async () => property;
User.find = () => ({ select: async () => adminIds.map((_id) => ({ _id })) });

const notifications = [];
let failNotifications = false;
Notification.create = async (payload) => {
  if (failNotifications) throw new Error('simulated persistence failure');
  notifications.push(payload);
  return payload;
};

function queryFor(document) {
  return {
    populate() { return this; },
    then(resolve, reject) { return Promise.resolve(document).then(resolve, reject); },
  };
}

let inquiry;
Inquiry.create = async (payload) => {
  inquiry = { ...payload, _id: id(), status: 'Pending', adminResponse: '', save: async () => {} };
  return inquiry;
};
Inquiry.findById = () => queryFor(inquiry);

let siteVisit;
SiteVisit.create = async (payload) => {
  siteVisit = { ...payload, _id: id(), status: 'Pending', adminResponse: '', confirmedDate: null, confirmedTime: '', save: async () => {} };
  return siteVisit;
};
SiteVisit.findById = () => queryFor(siteVisit);

const createdInquiry = await inquiryService.createInquiry({ buyerId, propertyId: propertyId.toString(), message: 'Interested' });
assert.ok(createdInquiry);
assert.equal(notifications.length, 2);
assert.ok(notifications.every((item) => item.type === 'inquiry_new' && item.relatedModel === 'Inquiry'));
assert.deepEqual(notifications.map((item) => item.recipientId.toString()), adminIds.map(String));

await siteVisitService.createSiteVisit({ buyerId, propertyId: propertyId.toString(), preferredDate: new Date('2027-06-15') });
assert.equal(notifications.length, 4);
assert.ok(notifications.slice(2).every((item) => item.type === 'site_visit_new' && item.relatedModel === 'SiteVisit'));

await inquiryService.updateInquiryStatus(inquiry._id.toString(), { status: 'Responded', adminResponse: 'Please call us.' });
assert.equal(notifications.length, 5);
assert.equal(notifications[4].type, 'inquiry_responded');
assert.equal(notifications[4].recipientId.toString(), buyerId.toString());

await inquiryService.updateInquiryStatus(inquiry._id.toString(), { status: 'Responded', adminResponse: 'Please call us.' });
assert.equal(notifications.length, 5, 'Identical re-save must not create a notification');

await siteVisitService.updateSiteVisitStatus(siteVisit._id.toString(), {
  status: 'Pending', adminResponse: 'We will coordinate a time with you.',
});
assert.equal(notifications.length, 6);
assert.equal(notifications[5].type, 'site_visit_responded');
assert.equal(notifications[5].relatedModel, 'SiteVisit');
assert.equal(notifications[5].relatedId.toString(), siteVisit._id.toString());
assert.equal(notifications[5].recipientId.toString(), buyerId.toString());

await siteVisitService.updateSiteVisitStatus(siteVisit._id.toString(), {
  status: 'Scheduled', confirmedDate: new Date('2027-06-15T00:00:00.000Z'), confirmedTime: '10:30',
});
assert.equal(notifications.length, 7);
assert.equal(notifications[6].type, 'site_visit_scheduled');

failNotifications = true;
const originalConsoleError = console.error;
console.error = () => {};
const createdDespiteFailure = await inquiryService.createInquiry({ buyerId, propertyId: propertyId.toString(), message: 'Still interested' });
console.error = originalConsoleError;
assert.ok(createdDespiteFailure, 'Notification failure must not fail the buyer request');

const loggedFailures = [];
console.error = (...args) => loggedFailures.push(args);
await siteVisitService.updateSiteVisitStatus(siteVisit._id.toString(), {
  status: 'Scheduled', confirmedDate: new Date('2027-06-15T00:00:00.000Z'), confirmedTime: '10:30',
  adminResponse: 'Updated arrival instructions.',
});
console.error = originalConsoleError;
assert.ok(loggedFailures.some(([, details]) => (
  details?.siteVisitId === siteVisit._id.toString() && details.errorMessage === 'simulated persistence failure'
)), 'Site visit notification failures must log the message and site visit ID');

console.log('Notification workflow tests passed: admin submissions, buyer updates, duplicate suppression, and best-effort failure handling.');
