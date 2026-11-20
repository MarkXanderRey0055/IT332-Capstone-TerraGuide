import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Property from './src/models/Property.js';
import User from './src/models/User.js';
import Transaction from './src/models/Transaction.js';
import Inquiry from './src/models/Inquiry.js';
import SiteVisit from './src/models/SiteVisit.js';
import { getRecentActivity } from './src/services/activityService.js';

const id = () => new mongoose.Types.ObjectId();
const now = new Date();
const propertyId = id();
const buyerId = id();
const records = {
  properties: [{ _id: propertyId, name: 'Target Property', createdAt: now }],
  buyers: [{ _id: buyerId, username: 'buyer', createdAt: now }],
  transactions: [{ _id: id(), reference: 'TRX-TARGET', status: 'Pending', createdAt: now, updatedAt: now, propertyId: { name: 'Target Property' } }],
  inquiries: [{ _id: id(), status: 'Pending', createdAt: now, updatedAt: now, buyerId: { fullName: 'Buyer' }, propertyId: { name: 'Target Property' } }],
  siteVisits: [{ _id: id(), status: 'Pending', createdAt: now, updatedAt: now, buyerId: { fullName: 'Buyer' }, propertyId: { name: 'Target Property' } }],
};

function queryFor(items) {
  return {
    sort() { return this; },
    limit() { return this; },
    select() { return this; },
    populate() { return this; },
    then(resolve, reject) { return Promise.resolve(items).then(resolve, reject); },
  };
}

Property.find = () => queryFor(records.properties);
User.find = () => queryFor(records.buyers);
Transaction.find = () => queryFor(records.transactions);
Inquiry.find = () => queryFor(records.inquiries);
SiteVisit.find = () => queryFor(records.siteVisits);

const events = await getRecentActivity(20);
const expectedModels = new Set(['Inquiry', 'SiteVisit', 'Transaction', 'Property', 'User']);
assert.ok(events.length >= expectedModels.size);
for (const event of events) {
  assert.ok(event.relatedId, `Missing relatedId for ${event.type}`);
  assert.ok(expectedModels.has(event.relatedModel), `Invalid relatedModel for ${event.type}`);
}
for (const model of expectedModels) assert.ok(events.some((event) => event.relatedModel === model));

console.log('Activity target tests passed: every event has a related ID and a supported related model.');
