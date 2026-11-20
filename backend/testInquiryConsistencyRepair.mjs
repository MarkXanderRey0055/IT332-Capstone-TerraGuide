import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Inquiry from './src/models/Inquiry.js';
import Notification from './src/models/Notification.js';
import { auditInquiryConsistency, isInquiryInconsistent } from './scripts/auditInquiryConsistency.mjs';

const notificationCalls = [];
Notification.create = async (...args) => notificationCalls.push(args);

const record = {
  _id: new mongoose.Types.ObjectId(),
  status: 'Pending',
  adminResponse: '  Please contact us to arrange a viewing.  ',
  buyerId: { email: 'buyer@example.test' },
  propertyId: { name: 'Test Property' },
  saves: 0,
  async save() { this.saves += 1; },
};
const closedRecord = {
  _id: new mongoose.Types.ObjectId(),
  status: 'Duplicate',
  adminResponse: '',
  buyerId: { email: 'closed@example.test' },
  propertyId: { name: 'Closed Property' },
  async save() { throw new Error('Consistency script must never save closed records'); },
};
let queriedStatuses;
Inquiry.find = (query) => {
  queriedStatuses = query.status.$in;
  return {
    populate: () => ({
      populate: async () => [record, closedRecord],
    }),
  };
};

const dryRunLines = [];
const dryRun = await auditInquiryConsistency({ log: (line) => dryRunLines.push(line) });
assert.equal(dryRun.matches.length, 1);
assert.match(dryRunLines.join('\n'), new RegExp(record._id.toString()));
assert.match(dryRunLines.join('\n'), /buyer@example\.test/);
assert.match(dryRunLines.join('\n'), /Test Property/);
assert.match(dryRunLines.join('\n'), /Total inconsistent inquiries: 1/);
assert.equal(record.status, 'Pending', 'Dry run must not change the record');
assert.equal(record.saves, 0);
assert.deepEqual(queriedStatuses, ['Pending', 'Responded']);
assert.equal(isInquiryInconsistent(closedRecord), false, 'Consistency checks must skip closed inquiries');

const applyLines = [];
const applied = await auditInquiryConsistency({ apply: true, log: (line) => applyLines.push(line) });
assert.equal(applied.changedIds[0], record._id.toString());
assert.equal(record.status, 'Responded');
assert.equal(record.adminResponse, '  Please contact us to arrange a viewing.  ');
assert.equal(record.saves, 1);
assert.match(applyLines.join('\n'), new RegExp(record._id.toString()));
assert.equal(notificationCalls.length, 0, 'Repair must not create notifications');
assert.equal(closedRecord.status, 'Duplicate');

console.log('Inquiry consistency repair tests passed: dry-run is read-only, apply updates status only, and notifications are not created.');
