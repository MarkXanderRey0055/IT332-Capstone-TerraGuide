import assert from 'node:assert/strict';
import { summarizeDataset } from './scripts/datasetSummary.mjs';

// a. summarizeDataset with a full set of counts returns lines containing each count
const fullCounts = {
  properties: {
    total: 42,
    byStatus: { Available: 25, Reserved: 10, Sold: 6, Archived: 1 },
    auditedCount: 30,
    missingOrInvalidOwnerCount: 2,
  },
  buyers: {
    total: 18,
    withPreferences: 11,
  },
  admins: {
    total: 3,
  },
  transactions: {
    total: 16,
    byStatus: { Reserved: 4, Processing: 3, Completed: 7, Cancelled: 2 },
    dateRange: {
      earliest: new Date('2026-01-15T00:00:00.000Z'),
      latest: new Date('2026-11-20T00:00:00.000Z'),
    },
    completedTotal: 7,
    completedWithDate: 5,
    completedWithoutDate: 2,
  },
  inquiries: {
    total: 29,
    byStatus: {
      Pending: 8,
      Responded: 9,
      'Not interested': 3,
      'Property unavailable': 2,
      Duplicate: 1,
      Converted: 6,
    },
    dateRange: {
      earliest: '2026-02-01T08:00:00.000Z',
      latest: '2026-11-21T12:00:00.000Z',
    },
  },
  siteVisits: {
    total: 14,
    byStatus: { Pending: 4, Scheduled: 6, Completed: 4 },
    dateRange: {
      earliest: '2026-03-05T00:00:00.000Z',
      latest: '2026-11-22T00:00:00.000Z',
    },
  },
  searchEvents: {
    total: 95,
    dateRange: {
      earliest: '2026-04-01T00:00:00.000Z',
      latest: '2026-11-25T00:00:00.000Z',
    },
    last30Days: 37,
  },
  audits: {
    total: 51,
    dateRange: {
      earliest: '2026-01-20T00:00:00.000Z',
      latest: '2026-11-24T00:00:00.000Z',
    },
  },
};

const fullOutput = summarizeDataset(fullCounts).join('\n');
assert.match(fullOutput, /Properties[\s\S]*Total:\s+42/);
assert.match(fullOutput, /Status - Available:\s+25/);
assert.match(fullOutput, /Status - Reserved:\s+10/);
assert.match(fullOutput, /Status - Sold:\s+6/);
assert.match(fullOutput, /Status - Other:\s+1/);
assert.match(fullOutput, /Audited properties:\s+30/);
assert.match(fullOutput, /Missing or invalid owner:\s+2/);
assert.match(fullOutput, /Total buyers:\s+18/);
assert.match(fullOutput, /Buyers with preferences:\s+11/);
assert.match(fullOutput, /Total admins:\s+3/);
assert.match(fullOutput, /Transactions[\s\S]*Total:\s+16/);
assert.match(fullOutput, /Completed total:\s+7/);
assert.match(fullOutput, /Completed with completedAt:\s+5/);
assert.match(fullOutput, /Completed without completedAt:\s+2/);
assert.match(fullOutput, /2026-01-15 to 2026-11-20/);
assert.match(fullOutput, /Inquiries[\s\S]*Total:\s+29/);
assert.match(fullOutput, /Site Visits[\s\S]*Total:\s+14/);
assert.match(fullOutput, /Search Events[\s\S]*Total:\s+95/);
assert.match(fullOutput, /Last 30 days:\s+37/);
assert.match(fullOutput, /Audits[\s\S]*Total:\s+51/);
assert.match(fullOutput, /2026-01-20 to 2026-11-24/);

// b. summarizeDataset with zero records prints zeros and does not crash
const zeroLines = summarizeDataset({});
const zeroOutput = zeroLines.join('\n');
assert.ok(zeroLines.length > 0);
assert.match(zeroOutput, /Properties[\s\S]*Total:\s+0/);
assert.match(zeroOutput, /Total buyers:\s+0/);
assert.match(zeroOutput, /Total admins:\s+0/);
assert.match(zeroOutput, /Transactions[\s\S]*Total:\s+0/);
assert.match(zeroOutput, /Completed without completedAt:\s+0/);
assert.match(zeroOutput, /createdAt range:\s+N\/A/);

// c. summarizeDataset output contains no email-like or owner-like strings when given fake personal values
const poisonedInput = {
  ...fullCounts,
  properties: {
    ...fullCounts.properties,
    owner: 'Juan Dela Cruz',
    email: 'secret.owner@example.com',
    byStatus: { ...fullCounts.properties.byStatus, 'owner@leak.test': 1 },
  },
  buyers: {
    ...fullCounts.buyers,
    emails: ['buyer@example.com'],
    fullName: 'Maria Santos',
  },
  admins: {
    ...fullCounts.admins,
    username: 'superadmin_secret',
    email: 'admin@terraguide.test',
  },
};

const poisonedOutput = summarizeDataset(poisonedInput).join('\n');
assert.equal(poisonedOutput.includes('Juan Dela Cruz'), false, 'must not output owner names');
assert.equal(poisonedOutput.includes('Maria Santos'), false, 'must not output buyer names');
assert.equal(poisonedOutput.includes('superadmin_secret'), false, 'must not output admin usernames');
assert.equal(/@/.test(poisonedOutput), false, 'must not output any email-like string');

console.log('Dataset summary tests passed: full counts formatted, zero records handled cleanly, personal data excluded.');
